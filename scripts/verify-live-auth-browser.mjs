// Opt-in real-browser integration: creates one development guest; no token traces saved.
import assert from 'node:assert/strict';
import {readFile, mkdir} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {chromium, expect} from '@playwright/test';
import {createGameServer} from '../server/server.js';
const env=parseEnv(await readFile(new URL('../server/.env',import.meta.url),'utf8'));
assert.equal(env.SUPABASE_URL,'https://ajmrlhfhrcsstauqgnip.supabase.co');
let app,web,browser;
let stage='startup';
try {
  app=createGameServer({env:{...env,PORT:'0'}});
  app.server.listen(0,'127.0.0.1');await once(app.server,'listening');
  const port=app.server.address().port;
  web=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,AUTH_PROXY_TARGET:`http://127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']});
  await Promise.race([once(web.stdout,'data'),once(web,'exit').then(()=>{throw Error('Web server failed');}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Startup timeout')),10000);t.unref();})]);
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:393,height:852}});
  // Only public staging configuration is substituted. HTTP auth and WebSocket traffic are real.
  await context.route('**/js/auth-config.js',route=>route.fulfill({contentType:'application/javascript',body:`export const AUTH_CONFIG={enabled:true,webBase:'/auth',socketUrl:'ws://127.0.0.1:${port}/ws'};`}));
  await context.addInitScript(()=>localStorage.setItem('daeguk-challenge-progress-v1',JSON.stringify({completedPuzzleIds:['basic-tutorial-01'],defeatedAiRanks:[],tutorialCompleted:true})));
  const page=await context.newPage();
  const profiles=[];
  page.on('websocket',ws=>ws.on('framereceived',({payload})=>{try{const m=JSON.parse(String(payload));if(m.type==='authenticated')profiles.push(m.player);}catch{}}));
  const url=`http://127.0.0.1:4185/?lang=ko&server=${encodeURIComponent(`ws://127.0.0.1:${port}/ws`)}`;
  async function enterOnline() {
    await expect(page.locator('[data-start-mode="pvp"]')).toBeVisible({timeout:10000});
    await page.locator('[data-start-mode="pvp"]').click();
    await expect(page.locator('#networkStatus')).toHaveText('대국장을 만들거나 입장하세요.',{timeout:25000});
  }
  stage='first browser login';
  await page.goto(url);await enterOnline();
  assert.equal(profiles.length,1);
  const first=profiles[0];
  console.log('BROWSER_GUEST_LOGIN_OK=true');
  stage='browser cookies';
  const cookies=await context.cookies();
  const refresh=cookies.find(c=>c.name==='daeguk-refresh');
  assert.ok(refresh?.httpOnly);assert.equal(refresh.sameSite,'Strict');
  assert.equal(await page.evaluate(()=>document.cookie.includes('daeguk-refresh')),false);
  const storage=await page.evaluate(()=>Object.keys(localStorage).filter(k=>/token|supabase|auth/i.test(k)));
  assert.deepEqual(storage,[]);
  console.log('HTTPONLY_COOKIE_AND_STORAGE_OK=true');
  stage='reload same identity';
  await page.reload();await enterOnline();
  assert.equal(profiles.length,2);assert.deepEqual(profiles[1],first);
  console.log('BROWSER_RELOAD_SAME_ID=true');
  stage='create waiting room';
  await page.locator('#createRoomBtn').click();
  await expect(page.locator('#networkLobbyStatus')).toContainText('상대를 기다리는 중',{timeout:10000});
  console.log('AUTHENTICATED_CREATE_ROOM_OK=true');
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/live-auth-browser.png',fullPage:true});
  console.log('LIVE_BROWSER_CHECK_OK=true (one development guest created)');
} catch(error) {
  console.error('FAILED_STAGE='+stage);
  console.error('ERROR_CODE='+(/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'CHECK_FAILED'));
  process.exitCode=1;
} finally {
  await browser?.close();
  if(web&&web.exitCode===null){web.kill('SIGTERM');await once(web,'exit');}
  await app?.close();
}
