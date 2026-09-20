// Explicit integration check: creates one guest in daeguk-dev. No credentials are logged.
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import pg from 'pg';
import { WebSocket } from 'ws';
import { createGameServer } from '../server/server.js';

const env = parseEnv(await readFile(new URL('../server/.env', import.meta.url), 'utf8'));
assert.equal(env.SUPABASE_URL, 'https://ajmrlhfhrcsstauqgnip.supabase.co');
assert.equal(new URL(env.DATABASE_URL).hostname, 'aws-0-us-west-2.pooler.supabase.com');
assert.equal(new URL(env.DATABASE_URL).username, 'daeguk_login.ajmrlhfhrcsstauqgnip');
const origin = 'http://127.0.0.1:4185';
let app;
let db;
let socket;
let stage = 'start';
let base;
let cookie;
async function start() {
  app = createGameServer({env:{...env, PORT:'0'}});
  app.server.listen(0,'127.0.0.1');
  await once(app.server,'listening');
  base=`http://127.0.0.1:${app.server.address().port}`;
}
async function session(create) {
  const res = await fetch(`${base}/auth/session`, {method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify({create}),signal:AbortSignal.timeout(20000)});
  assert.equal(res.status,200,'Auth HTTP response must be 200');
  const setCookie=res.headers.get('set-cookie');
  assert.ok(setCookie?.includes('HttpOnly'));
  assert.ok(setCookie.includes('SameSite=Strict'));
  cookie=setCookie.split(';')[0];
  const data=await res.json();
  assert.equal(data.refreshToken,undefined);
  assert.deepEqual(Object.keys(data.player).sort(),['nickname','publicCode']);
  return data;
}
try {
  await start();
  stage='guest creation';
  const first=await session(true);
  console.log('GUEST_LOGIN_OK=true');
  stage='persisted identity';
  db=new pg.Client({connectionString:env.DATABASE_URL,connectionTimeoutMillis:10000});
  await db.connect();
  const check=()=>db.query('SELECT p.id FROM daeguk_private.players p JOIN daeguk_private.identities i ON i.player_id=p.id WHERE p.public_code=$1',[first.player.publicCode]);
  const persisted=await check();
  assert.equal(persisted.rowCount,1);
  console.log('IDENTITY_SAVED_OK=true');
  stage='cookie refresh';
  const refreshed=await session(false);
  assert.deepEqual(refreshed.player,first.player);
  console.log('COOKIE_REFRESH_SAME_PLAYER=true');
  stage='server restart';
  await app.close();app=null;
  await start();
  const restored=await session(false);
  assert.deepEqual(restored.player,first.player);
  const again=await check();
  assert.equal(again.rowCount,1);
  assert.equal(again.rows[0].id,persisted.rows[0].id);
  console.log('SERVER_RESTART_SAME_PLAYER=true');
  stage='websocket authentication';
  socket=new WebSocket(base.replace('http:','ws:')+'/ws',{origin});
  await once(socket,'open');
  async function command(body) {
    const next=once(socket,'message',{signal:AbortSignal.timeout(10000)});
    socket.send(JSON.stringify(body));
    return JSON.parse((await next)[0]);
  }
  const authenticated=await command({type:'authenticate',accessToken:restored.accessToken});
  assert.equal(authenticated.type,'authenticated');
  assert.deepEqual(authenticated.player,first.player);
  const rooms=await command({type:'list_rooms'});
  assert.equal(rooms.type,'room_list');
  console.log('WEBSOCKET_AUTH_AND_LOBBY_OK=true');
  console.log('LIVE_AUTH_CHECK_OK=true (one development guest created)');
} catch(error) {
  console.error('FAILED_STAGE='+stage);
  console.error('ERROR_CODE='+(/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'UNKNOWN'));
  // Assertion values can include profile/token objects, so never print the error object.
  process.exitCode=1;
} finally {
  socket?.terminate();
  await db?.end().catch(()=>{});
  await app?.close().catch(()=>{});
}
