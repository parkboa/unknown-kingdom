let scriptLoading;

function loadTurnstile() {
  if (globalThis.turnstile) return Promise.resolve(globalThis.turnstile);
  if (!scriptLoading) {
    scriptLoading = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timeout = setTimeout(() => finish(new Error('CAPTCHA loading timed out')), 15000);
      function finish(error) {
        clearTimeout(timeout);
        script.onload = script.onerror = null;
        if (error) { script.remove(); reject(error); }
        else resolve(globalThis.turnstile);
      }
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => finish(globalThis.turnstile ? null : new Error('CAPTCHA unavailable'));
      script.onerror = () => finish(new Error('CAPTCHA unavailable'));
      document.head.append(script);
    }).catch(error => { scriptLoading = undefined; throw error; });
  }
  return scriptLoading;
}

export function requestGuestCaptcha(siteKey, nativeBridge) {
  if (nativeBridge) {
    return nativeBridge.requestCaptcha({ language: document.documentElement.lang === 'ko' ? 'ko' : 'en' }).then(result => {
      if (typeof result?.token !== 'string' || !result.token || result.token.length > 4096) throw new Error('Invalid CAPTCHA response');
      return result.token;
    });
  }
  if (!siteKey) return Promise.reject(new Error('CAPTCHA site key is not configured'));
  const ko = document.documentElement.lang === 'ko';
  return new Promise((resolve, reject) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'guest-captcha';
    dialog.setAttribute('aria-labelledby', 'guest-captcha-title');
    const title = document.createElement('h2');
    title.id = 'guest-captcha-title';
    title.textContent = ko ? '온라인 대국 시작' : 'Start online play';
    const description = document.createElement('p');
    description.textContent = ko ? '게스트 계정을 만들기 전에 사람인지 확인해 주세요.' : 'Verify you are human before creating your guest account.';
    const widget = document.createElement('div');
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.textContent = ko ? '인증을 불러오는 중…' : 'Loading verification…';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = ko ? '취소' : 'Cancel';
    dialog.append(title, description, widget, status, cancel);
    document.body.append(dialog);
    let settled = false;
    let widgetId;
    let api;
    const timeout = setTimeout(() => finish(new Error('CAPTCHA timed out')), 180000);
    function finish(error, token) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (widgetId !== undefined) api.remove(widgetId);
      dialog.close();
      dialog.remove();
      previousFocus?.focus();
      if (error) reject(error);
      else resolve(token);
    }
    cancel.onclick = () => finish(new Error('CAPTCHA cancelled'));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(new Error('CAPTCHA cancelled')); });
    dialog.showModal();
    loadTurnstile().then(turnstile => {
      if (settled) return;
      api = turnstile;
      status.textContent = '';
      widgetId = api.render(widget, {
        sitekey: siteKey, theme: 'dark', language: ko ? 'ko' : 'en', size: 'flexible',
        callback: token => finish(null, token),
        'error-callback': () => {
          status.textContent = ko ? '인증을 불러오지 못했습니다. 연결을 확인하거나 취소 후 다시 시도해 주세요.' : 'Verification failed to load. Check your connection or cancel and try again.';
        },
        'expired-callback': () => api.reset(widgetId),
        'timeout-callback': () => api.reset(widgetId),
      });
    }).catch(error => finish(error));
  });
}
