import { test, expect } from '@playwright/test';

async function prepare(page) {
  // Isolate authentication from the game's independent startup availability probe.
  await page.route('http://127.0.0.1:4185/', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="en"><head><link rel="stylesheet" href="/styles.css"></head><body></body></html>'}));
  await page.route('**/js/auth-config.js', route => route.fulfill({contentType:'application/javascript',body:
    `export const AUTH_CONFIG={enabled:true,webBase:'/auth',captchaSiteKey:'test-key',socketUrl:'ws://127.0.0.1:4175/ws'};`}));
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({contentType:'application/javascript',body:
    `window.turnstile={render(node,options){window.testCaptcha=options;node.textContent='Test verification widget';return 'widget';},remove(){window.widgetRemoved=true;},reset(){}};`}));
  await page.goto('/');
}

test('first guest waits for CAPTCHA before creating an account or opening a socket; reload restores identity', async ({page}) => {
  const requests=[];
  let created=false;
  let sockets=0;
  await page.route('**/auth/session', route => {
    const body=route.request().postDataJSON();requests.push(body);
    if(!created && !body.create)return route.fulfill({status:401,json:{error:'NO_SESSION'}});
    if(body.create){expect(body.captchaToken).toBe('test-proof');created=true;}
    return route.fulfill({json:{accessToken:'access',expiresAt:Date.now()+300000,player:{publicCode:'SAME-ID',nickname:'Guest'}}});
  });
  await page.routeWebSocket('ws://127.0.0.1:4175/ws', ws => {
    sockets++;
    ws.onMessage(raw=>{if(JSON.parse(raw).type==='authenticate')ws.send(JSON.stringify({type:'authenticated',player:{publicCode:'SAME-ID',nickname:'Guest'}}));});
  });
  await prepare(page);
  const connect=()=>page.evaluate(async()=>{
    const {connectNetwork}=await import('/js/network.js');
    window.testSession=connectNetwork({type:'list_rooms'},{url:'ws://127.0.0.1:4175/ws',onStatus(){},onClose(){},onMessage(){}});
  });
  await connect();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(sockets).toBe(0);expect(requests).toHaveLength(1);
  await expect(page.getByText('Test verification widget')).toBeVisible();
  const bounds=await page.getByRole('dialog').boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(393);
  await page.evaluate(()=>window.testCaptcha.callback('test-proof'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>window.testSession.profile?.publicCode)).toBe('SAME-ID');
  expect(sockets).toBe(1);
  await page.reload();await connect();
  await expect.poll(()=>page.evaluate(()=>window.testSession.profile?.publicCode)).toBe('SAME-ID');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.filter(r=>r.create)).toHaveLength(1);
});

test('cancel prevents account creation; next attempt opens a fresh challenge', async ({page}) => {
  const requests=[];
  await page.route('**/auth/session',route=>{requests.push(route.request().postDataJSON());return route.fulfill({status:401,json:{error:'NO_SESSION'}});});
  await prepare(page);
  const begin=()=>page.evaluate(async()=>{
    const {getOnlineIdentity}=await import('/js/auth.js');
    window.authAttempt=getOnlineIdentity('ws://127.0.0.1:4175/ws').catch(()=>null);
  });
  await begin();
  await expect(page.getByText('Test verification widget')).toBeVisible();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await begin();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests.every(r=>r.create===false)).toBe(true);
});
