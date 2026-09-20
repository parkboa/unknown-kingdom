import { test, expect } from '@playwright/test';

for (const missing of ['plugin', 'get', 'set', 'clear', 'requestCaptcha']) {
  test(`missing native ${missing} fails before any authentication request or socket`, async ({page}) => {
    let requests = 0;
    let sockets = 0;
    await page.addInitScript(missing => {
      const plugin = {get:async()=>({value:null}),set:async()=>{},clear:async()=>{},requestCaptcha:async()=>({token:'unused'})};
      delete plugin[missing];
      window.Capacitor = {isNativePlatform:()=>true,Plugins:missing==='plugin'?{}:{DaegukSession:plugin}};
    }, missing);
    await page.route('http://127.0.0.1:4185/', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><body></body></html>'}));
    await page.route('**/js/auth-config.js', route => route.fulfill({contentType:'application/javascript',body:
      `export const AUTH_CONFIG={enabled:true,nativeBase:'/auth',socketUrl:'ws://127.0.0.1:4175/ws'};`}));
    await page.route('**/auth/session', route => { requests++; return route.fulfill({status:500}); });
    await page.routeWebSocket('ws://127.0.0.1:4175/ws', () => { sockets++; });
    await page.goto('/');
    const statuses = await page.evaluate(async () => {
      const {connectNetwork} = await import('/js/network.js');
      const statuses = [];
      return new Promise(resolve => connectNetwork({type:'list_rooms'},{
        url:'ws://127.0.0.1:4175/ws', connectingMessage:'connecting', unavailableMessage:'SERVER_FAILURE',
        authenticationFailedMessage:'AUTHENTICATION_FAILURE', onMessage(){},onClose(){},
        onStatus(message){ statuses.push(message); if(message.includes('NATIVE_BRIDGE_UNAVAILABLE')) resolve(statuses); },
      }));
    });
    expect(statuses).toEqual(['connecting','AUTHENTICATION_FAILURE (NATIVE_BRIDGE_UNAVAILABLE)']);
    expect({requests,sockets}).toEqual({requests:0,sockets:0});
  });
}

test('HTTPS verification page does not challenge or create an account outside the native bridge', async ({page}) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('/js/native-captcha.html?lang=ko');
  await expect(page.getByRole('status')).toHaveText('DAEGUK 앱에서 온라인 대국을 시작해 주세요.');
  expect(requests.some(url => url.includes('challenges.cloudflare.com') || url.includes('/auth/session'))).toBe(false);
});

test('HTTPS verification page sends only proof or cancellation to the native handler', async ({page}) => {
  await page.addInitScript(() => {
    window.captchaMessages = [];
    window.webkit = {messageHandlers:{daegukCaptcha:{postMessage: message => window.captchaMessages.push(message)}}};
  });
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    contentType:'application/javascript', body:`window.turnstile={render(node,options){window.challenge=options;node.textContent='Mock widget';return 1;},remove(){},reset(){}};`,
  }));
  await page.goto('/js/native-captcha.html?lang=ko');
  await expect(page.getByText('Mock widget')).toBeVisible();
  await page.evaluate(() => window.challenge.callback('mock-proof'));
  await expect(page.getByRole('status')).toHaveText('확인이 완료되었습니다.');
  expect(await page.evaluate(() => window.captchaMessages)).toEqual([{token:'mock-proof'}]);
  await page.reload();
  await expect(page.getByText('Mock widget')).toBeVisible();
  await page.getByRole('button', {name:'취소',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('확인이 종료되었습니다.');
  expect(await page.evaluate(() => window.captchaMessages)).toEqual([{error:'CAPTCHA_UNAVAILABLE'}]);
});

test('native startup uses its CAPTCHA bridge once and restores the same profile after reload', async ({page}) => {
  let saved = null;
  let challenges = 0;
  let creates = 0;
  let refreshes = 0;
  await page.exposeFunction('readTestKeychain', () => ({value:saved}));
  await page.exposeFunction('writeTestKeychain', ({value}) => { saved = value; });
  await page.exposeFunction('clearTestKeychain', () => { saved = null; });
  await page.exposeFunction('testNativeCaptcha', () => { challenges++; return {token:'mock-native-proof'}; });
  await page.addInitScript(() => {
    // JSExport.swift injects Plugins; the standalone native bridge has no registerPlugin.
    window.Capacitor = {isNativePlatform:()=>true, Plugins:{DaegukSession:{
      get:window.readTestKeychain, set:window.writeTestKeychain, clear:window.clearTestKeychain, requestCaptcha:window.testNativeCaptcha,
    }}};
  });
  await page.route('**/js/auth-config.js', route => route.fulfill({contentType:'application/javascript',body:
    `export const AUTH_CONFIG={enabled:true,nativeBase:'/auth',captchaSiteKey:'mock-key',socketUrl:'wss://game.test/ws'};`}));
  await page.route('**/auth/session', route => {
    const body = route.request().postDataJSON();
    if (!body.refreshToken && !body.create) return route.fulfill({status:401,json:{error:'NO_SESSION'}});
    if (body.create) { creates++; expect(body.captchaToken).toBe('mock-native-proof'); }
    else { refreshes++; expect(body.refreshToken).toBe('rotated-1'); }
    return route.fulfill({json:{accessToken:'test-access',expiresAt:Date.now()+300000,
      refreshToken:`rotated-${creates+refreshes}`,player:{publicCode:'SAME-NATIVE-ID',nickname:'Guest'}}});
  });
  await page.route('http://127.0.0.1:4185/', route => route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><body></body></html>'}));
  await page.goto('/');
  expect(await page.evaluate(() => typeof window.Capacitor.registerPlugin)).toBe('undefined');
  const connect = () => page.evaluate(async () => {
    const { getOnlineIdentity } = await import('/js/auth.js');
    const identity = await getOnlineIdentity('wss://game.test/ws');
    return {code:identity.player.publicCode, hasRefresh:'refreshToken' in identity};
  });
  expect(await connect()).toEqual({code:'SAME-NATIVE-ID',hasRefresh:false});
  await page.reload();
  expect(await connect()).toEqual({code:'SAME-NATIVE-ID',hasRefresh:false});
  expect({challenges,creates,refreshes,saved}).toEqual({challenges:1,creates:1,refreshes:1,saved:'rotated-2'});
});
