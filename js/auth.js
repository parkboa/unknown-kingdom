import { AUTH_CONFIG } from './auth-config.js';
import { requestGuestCaptcha } from './captcha.js';

export function createGuestAuth({ config, fetcher = fetch, native = false, secureStorage, locks = globalThis.navigator?.locks, captchaProvider }) {
  let cached;
  let inflight;
  async function request(create, captchaToken) {
    if (native && !secureStorage) throw new Error('Secure session storage unavailable');
    const saved = native ? await secureStorage.get() : null;
    const response = await fetcher(`${native ? config.nativeBase : config.webBase}/session`, {
      method: 'POST', credentials: native ? 'omit' : 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ create, captchaToken, ...(native && saved?.value ? { refreshToken: saved.value } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401 && !create && !saved?.value) {
      const error = await response.json();
      if (error.error === 'NO_SESSION') {
        const token = captchaToken || (captchaProvider ? await captchaProvider() : undefined);
        if (captchaProvider && !token) throw new Error('CAPTCHA verification required');
        return request(true, token);
      }
    }
    if (!response.ok) {
      const error = new Error('Guest authentication unavailable');
      error.code = response.status === 429 ? 'RATE_LIMITED' : response.status === 403 ? 'ORIGIN_DENIED' : 'AUTH_FAILED';
      throw error;
    }
    const result = await response.json();
    if (typeof result.accessToken !== 'string' || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) throw new Error('Invalid authentication response');
    if (native) {
      if (typeof result.refreshToken !== 'string') throw new Error('Missing secure session');
      await secureStorage.set({ value: result.refreshToken });
    }
    // Only the short-lived access token is retained in JavaScript memory.
    cached = { accessToken: result.accessToken, expiresAt: result.expiresAt, player: result.player };
    return cached;
  }
  return {
    async getSession(captchaToken) {
      if (cached && cached.expiresAt > Date.now() + 60000) return cached;
      if (!inflight) {
        const work = () => request(false, captchaToken);
        inflight = (locks ? locks.request('daeguk-auth-refresh', work) : work()).finally(() => { inflight = null; });
      }
      return inflight;
    },
  };
}

let auth;
export async function getOnlineIdentity(socketUrl) {
  if (!AUTH_CONFIG.enabled) return null;
  // Never send credentials to a server chosen through query parameters or localStorage.
  if (new URL(socketUrl).href !== new URL(AUTH_CONFIG.socketUrl).href) throw new Error('Untrusted game server');
  if (!auth) {
    const native = globalThis.Capacitor?.isNativePlatform?.() === true;
    const secureStorage = native ? globalThis.Capacitor.registerPlugin('DaegukSession') : undefined;
    auth = createGuestAuth({ config: AUTH_CONFIG, native, secureStorage,
      captchaProvider: () => requestGuestCaptcha(AUTH_CONFIG.captchaSiteKey) });
  }
  return auth.getSession();
}
