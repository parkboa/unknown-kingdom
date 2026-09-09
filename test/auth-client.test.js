import test from 'node:test';
import assert from 'node:assert/strict';
import { createGuestAuth } from '../js/auth.js';
const config={webBase:'/auth',nativeBase:'https://game.test/auth'};
const result=()=>({accessToken:'access',expiresAt:Date.now()+300000,refreshToken:'rotated',player:{publicCode:'public'}});
test('CAPTCHA runs once for first creation, and never for refresh', async () => {
  let challenges=0;
  const calls=[];
  const auth=createGuestAuth({config,captchaProvider:async()=>{challenges++;return 'captcha-proof';},fetcher:async(url,options)=>{
    calls.push(JSON.parse(options.body));
    return calls.length===1?{status:401,ok:false,json:async()=>({error:'NO_SESSION'})}:{ok:true,json:async()=>result()};
  }});
  await Promise.all([auth.getSession(),auth.getSession()]);
  assert.equal(challenges,1);
  assert.equal(calls[0].captchaToken,undefined);
  assert.equal(calls[1].captchaToken,'captcha-proof');
  const refresh=createGuestAuth({config,captchaProvider:async()=>{throw new Error('must not challenge');},fetcher:async()=>({ok:true,json:async()=>result()})});
  await refresh.getSession();
});
test('cancelled or empty CAPTCHA cannot create a guest and a new attempt can retry', async () => {
  for (const empty of [true,false]) {
    let attempts=0;
    const creates=[];
    const auth=createGuestAuth({config,captchaProvider:async()=>{
      if (++attempts===1) { if(empty)return ''; throw new Error('cancelled'); }
      return 'fresh-token';
    },fetcher:async(url,options)=>{
      const body=JSON.parse(options.body);
      if(!body.create)return {status:401,ok:false,json:async()=>({error:'NO_SESSION'})};
      creates.push(body);return {ok:true,json:async()=>result()};
    }});
    await assert.rejects(auth.getSession());
    assert.equal(creates.length,0);
    await auth.getSession();
    assert.equal(creates.length,1);
    assert.equal(creates[0].captchaToken,'fresh-token');
  }
});
test('web guest creation is single-flight and tokens stay out of persistent JS storage',async()=>{
  const calls=[];
  const auth=createGuestAuth({config,fetcher:async(url,options)=>{
    calls.push(options);return calls.length===1?{status:401,ok:false,json:async()=>({error:'NO_SESSION'})}:{ok:true,json:async()=>result()};
  }});
  const [a,b]=await Promise.all([auth.getSession(),auth.getSession()]);
  assert.equal(calls.length,2);assert.equal(a,b);assert.equal(a.refreshToken,undefined);
  assert.equal(calls[0].credentials,'include');assert.equal(JSON.parse(calls[1].body).create,true);
  await auth.getSession(); assert.equal(calls.length,2);
});
test('native refresh reads and rotates Keychain value before returning',async()=>{
  let saved;
  const auth=createGuestAuth({config,native:true,secureStorage:{get:async()=>({value:'old'}),set:async v=>{saved=v.value;}},fetcher:async(url,options)=>{
    assert.equal(JSON.parse(options.body).refreshToken,'old');return {ok:true,json:async()=>result()};
  }});
  const session=await auth.getSession();assert.equal(saved,'rotated');assert.equal(session.refreshToken,undefined);
});
test('native fails closed without secure storage and never replaces invalid identity with a new guest',async()=>{
  await assert.rejects(createGuestAuth({config,native:true}).getSession(),/Secure/);
  let count=0;
  const auth=createGuestAuth({config,fetcher:async()=>{count++;return {status:401,ok:false,json:async()=>({error:'AUTH_FAILED'})};}});
  await assert.rejects(auth.getSession()); assert.equal(count,1);
});
