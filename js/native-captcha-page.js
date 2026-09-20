import { AUTH_CONFIG } from './auth-config.js';
import { requestGuestCaptcha } from './captcha.js';

const ko = new URL(location.href).searchParams.get('lang') === 'ko';
document.documentElement.lang = ko ? 'ko' : 'en';
const status = document.querySelector('#verificationStatus');
// This standalone HTTPS page has no Capacitor/Keychain bridge and never creates an account.
const channel = globalThis.webkit?.messageHandlers?.daegukCaptcha;
if (!channel) {
  status.textContent = ko ? 'DAEGUK 앱에서 온라인 대국을 시작해 주세요.' : 'Start online play in the DAEGUK app.';
} else {
  requestGuestCaptcha(AUTH_CONFIG.captchaSiteKey).then(token => {
    channel.postMessage({ token });
    status.textContent = ko ? '확인이 완료되었습니다.' : 'Verification complete.';
  }).catch(() => {
    channel.postMessage({ error: 'CAPTCHA_UNAVAILABLE' });
    status.textContent = ko ? '확인이 종료되었습니다. 앱에서 다시 시도해 주세요.' : 'Verification ended. Try again in the app.';
  });
}
