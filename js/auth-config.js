// Activate together with the server only after applying the DB migration and verifying staging.
// Public settings only. Never place a database password, secret key or refresh token here.
export const AUTH_CONFIG = Object.freeze({
  enabled: true,
  captchaSiteKey: '0x4AAAAAAEuIGij20RaeWsH5', // Public Turnstile site key.
  webBase: '/auth', // Reverse proxy on the SAME origin as the web app (HttpOnly cookie).
  nativeBase: 'https://unknown-kingdom-server.onrender.com/auth',
  socketUrl: 'wss://unknown-kingdom-server.onrender.com/ws',
});
