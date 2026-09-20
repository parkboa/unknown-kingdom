import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { authConfiguration, verifyAccessToken, createIdentityStore } from './auth.js';
import { fixedWindowLimiter, createAuthHttpHandler } from './auth-http.js';
import http from 'node:http';
import { once } from 'node:events';

const issuer = 'https://example.supabase.co/auth/v1';
const sub = 'a4a63ed6-cd42-4fdb-af96-c33df90ebada';
const sessionId = 'b4a63ed6-cd42-4fdb-af96-c33df90ebada';
const keys = await generateKeyPair('ES256');
async function token(overrides = {}, signingKey = keys.privateKey) {
  return new SignJWT({ role: 'authenticated', session_id: sessionId, ...overrides })
    .setProtectedHeader({ alg: 'ES256' }).setIssuer(issuer).setAudience('authenticated')
    .setSubject(sub).setIssuedAt().setExpirationTime('5m').sign(signingKey);
}
test('JWT validates signature, issuer, audience, expiry, session and role', async () => {
  const options = { issuer, key: keys.publicKey };
  assert.equal((await verifyAccessToken(await token(), options)).sub, sub);
  const other = await generateKeyPair('ES256');
  for (const invalid of [await token({}, other.privateKey), await token({ role: 'service_role' }), await token({ session_id: 'fake' }), 'malformed']) {
    await assert.rejects(verifyAccessToken(invalid, options));
  }
  await assert.rejects(verifyAccessToken(await token(), { ...options, issuer: 'https://attacker/auth/v1' }));
  const expired = await new SignJWT({role:'authenticated', session_id:sessionId}).setProtectedHeader({alg:'ES256'}).setSubject(sub).setIssuer(issuer).setAudience('authenticated').setIssuedAt(1).setExpirationTime(2).sign(keys.privateKey);
  await assert.rejects(verifyAccessToken(expired, options));
  const wrongAudience = await new SignJWT({role:'authenticated', session_id:sessionId}).setProtectedHeader({alg:'ES256'}).setSubject(sub).setIssuer(issuer).setAudience('anon').setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
  await assert.rejects(verifyAccessToken(wrongAudience, options));
});
test('configuration fails closed for partial configuration', () => {
  assert.equal(authConfiguration({}), null);
  assert.throws(() => authConfiguration({ SUPABASE_URL: issuer }));
  assert.throws(() => authConfiguration({ AUTH_MODE: 'required' }));
  assert.throws(() => authConfiguration({AUTH_MODE:'required',SUPABASE_URL:'https://example.supabase.co',SUPABASE_PUBLISHABLE_KEY:'public',DATABASE_URL:'postgres://localhost/db',AUTH_ALLOWED_ORIGINS:'https://game.test'}),/SUPABASE_SECRET_KEY/);
});
test('rate limiter rejects excess requests and expires windows', () => {
  let now = 0;
  const allow = fixedWindowLimiter({limit:2, intervalMs:100, now:()=>now});
  assert.equal(allow('one'), true); assert.equal(allow('one'), true); assert.equal(allow('one'), false);
  assert.equal(allow('two'), true); now = 101; assert.equal(allow('one'), true);
});
test('identity lookup uses verified subject and rolls back revoked sessions', async () => {
  const queries=[]; let released=false;
  const store=createIdentityStore({connect:async()=>({
    query:async(sql,params)=>{queries.push([sql,params]); return {rowCount:0,rows:[]};},
    release:()=>{released=true;}
  })});
  await assert.rejects(store.resolve({iss:issuer,sub,session_id:sessionId}), /revoked/);
  assert.deepEqual(queries[1][1], [sessionId,sub]);
  assert.equal(queries.at(-1)[0],'ROLLBACK'); assert.equal(released,true);
});
test('identity removal calls the narrow database deletion function',async()=>{
  let query;
  const store=createIdentityStore({query:async(sql,params)=>{query=[sql,params];return {rows:[{deleted:true}]};}});
  await store.remove({iss:issuer,sub},'player-id');
  assert.match(query[0],/delete_player_identity/);
  assert.deepEqual(query[1],[issuer,sub,'player-id']);
});
test('auth HTTP rejects cross-origin requests, keeps web refresh tokens HttpOnly and rotates existing sessions', async t => {
  const calls=[];const deleted=[];
  const handler=createAuthHttpHandler({config:{origins:new Set(['https://game.test','capacitor://localhost']),secureCookies:true},
    session:async(refresh)=>{calls.push(refresh);return {accessToken:'access',refreshToken:'refresh-new',expiresAt:Date.now()+300000,player:{id:'private',publicCode:'public',nickname:'Guest'}};},
    deleteAccount:async refresh=>{deleted.push(refresh);return {id:'private'};}},{onAccountDeleted:player=>deleted.push(player.id)});
  const server=http.createServer(handler); server.listen(0,'127.0.0.1'); await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();});
  const url=`http://127.0.0.1:${server.address().port}/auth/session`;
  const post=(origin,body={},cookie)=>fetch(url,{method:'POST',headers:{origin,'Content-Type':'application/json',...(cookie?{cookie}:{})},body:JSON.stringify(body)});
  assert.equal((await post('https://evil.test',{create:true})).status,403);
  assert.equal((await post('https://game.test')).status,401);
  let response=await post('https://game.test',{create:true});
  assert.equal(response.status,200);
  assert.match(response.headers.get('set-cookie'), /__Host-daeguk-refresh=refresh-new; HttpOnly; Path=\/; SameSite=Strict/);
  assert.match(response.headers.get('set-cookie'), /Secure/);
  const body=await response.json(); assert.equal(body.refreshToken,undefined);assert.equal(body.player.id,undefined);
  await post('https://game.test',{},'__Host-daeguk-refresh=old'); assert.equal(calls.at(-1),'old');
  response=await post('capacitor://localhost',{refreshToken:'native-old'});
  assert.equal((await response.json()).refreshToken,'refresh-new');assert.equal(calls.at(-1),'native-old');
  assert.equal((await post('https://game.test',null)).status,401);
  response=await fetch(`${url.replace('/session','/account')}`,{method:'DELETE',headers:{origin:'https://game.test','Content-Type':'application/json',cookie:'__Host-daeguk-refresh=delete-me'},body:'{}'});
  assert.equal(response.status,204);assert.deepEqual(deleted,['delete-me','private']);
  assert.match(response.headers.get('set-cookie'),/__Host-daeguk-refresh=;.*Max-Age=0/);
});
