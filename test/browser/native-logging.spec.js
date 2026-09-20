import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const config = JSON.parse(await readFile(new URL('../../capacitor.config.json', import.meta.url), 'utf8'));
const nativeBridge = await readFile(new URL('../../node_modules/@capacitor/ios/Capacitor/Capacitor/assets/native-bridge.js', import.meta.url), 'utf8');

for (const control of [false, true]) {
  test(`native authentication payload logging ${control ? 'positive control' : 'disabled by app configuration'}`, async ({page}) => {
    expect(config.ios.loggingBehavior).toBe('none');
    await page.goto('about:blank');
    await page.evaluate(loggingEnabled => {
      window.nativeMessages = [];
      window.Capacitor = {isLoggingEnabled:loggingEnabled, Plugins:{}};
      window.webkit = {messageHandlers:{bridge:{postMessage:message=>window.nativeMessages.push(message)}}};
    }, control || config.ios.loggingBehavior !== 'none');
    // Execute the installed vendor runtime rather than mocking its logging decisions.
    await page.addScriptTag({content:nativeBridge});
    const result = await page.evaluate(async () => {
      const cap = window.Capacitor;
      const logged = [];
      cap.logToNative = data => logged.push(['request',data.methodName]);
      cap.logFromNative = data => logged.push(['response',data.methodName]);
      const responses = [];
      for (const [method,options,data] of [
        ['set',{value:'synthetic-refresh-secret'},{}],
        ['get',{}, {value:'synthetic-refresh-secret'}],
        ['requestCaptcha',{language:'ko'},{token:'synthetic-captcha-secret'}],
      ]) {
        const pending = cap.nativePromise('DaegukSession',method,options);
        const call = window.nativeMessages.findLast(message => message.pluginId==='DaegukSession');
        cap.fromNative({callbackId:call.callbackId,pluginId:'DaegukSession',methodName:method,success:true,data});
        responses.push(await pending);
      }
      return {logged,responses,methods:window.nativeMessages.filter(message=>message.pluginId==='DaegukSession').map(message=>message.methodName)};
    });
    expect(result.methods).toEqual(['set','get','requestCaptcha']);
    expect(result.responses).toEqual([{}, {value:'synthetic-refresh-secret'}, {token:'synthetic-captcha-secret'}]);
    expect(result.logged).toEqual(control ? [
      ['request','set'],['response','set'],['request','get'],['response','get'],
      ['request','requestCaptcha'],['response','requestCaptcha'],
    ] : []);
  });
}
