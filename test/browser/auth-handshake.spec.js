import { test, expect } from '@playwright/test';

test('online client authenticates before room commands and exposes only public profile', async ({page}) => {
  const received=[];
  await page.route('**/js/auth-config.js', route=>route.fulfill({contentType:'application/javascript',body:`export const AUTH_CONFIG={enabled:true,webBase:'/auth',socketUrl:'ws://127.0.0.1:4175/ws'};`}));
  await page.route('**/auth/session', route=>route.fulfill({json:{accessToken:'test-access',expiresAt:Date.now()+300000,player:{publicCode:'PUBLIC',nickname:'Guest'}}}));
  await page.routeWebSocket('ws://127.0.0.1:4175/ws', ws=>ws.onMessage(raw=>{
    const m=JSON.parse(raw);received.push(m.type);
    if(m.type==='authenticate')ws.send(JSON.stringify({type:'authenticated',player:{publicCode:'PUBLIC',nickname:'Guest'},expiresAt:Date.now()+300000}));
    if(m.type==='list_rooms')ws.send(JSON.stringify({type:'room_list',rooms:[]}));
  }));
  await page.goto('/');
  const profile=await page.evaluate(async()=>{
    const {connectNetwork}=await import('/js/network.js');
    return new Promise(resolve=>{
      const session=connectNetwork({type:'list_rooms'},{url:'ws://127.0.0.1:4175/ws',onStatus(){},onClose(){},onMessage(m){if(m.type==='room_list'){resolve(session.profile);session.socket.close();}}});
    });
  });
  expect(received).toEqual(['authenticate','list_rooms']);
  expect(profile).toEqual({publicCode:'PUBLIC',nickname:'Guest'});
  expect(await page.evaluate(()=>Object.keys(localStorage).filter(k=>/token|supabase|auth/i.test(k)))).toEqual([]);
});

test('failed guest authentication does not fall back to unauthenticated matchmaking',async({page})=>{
  const received=[];
  await page.route('**/js/auth-config.js',route=>route.fulfill({contentType:'application/javascript',body:`export const AUTH_CONFIG={enabled:true,webBase:'/auth',socketUrl:'ws://127.0.0.1:4175/ws'};`}));
  await page.route('**/auth/session',route=>route.fulfill({status:401,json:{error:'AUTH_FAILED'}}));
  await page.routeWebSocket('ws://127.0.0.1:4175/ws',ws=>ws.onMessage(m=>received.push(m)));
  await page.goto('/');
  await page.evaluate(async()=>{
    const {connectNetwork}=await import('/js/network.js');
    return new Promise(resolve=>connectNetwork({type:'list_rooms'},{url:'ws://127.0.0.1:4175/ws',onStatus(){},onClose(){resolve();},onMessage(){}}));
  });
  expect(received).toEqual([]);
});
