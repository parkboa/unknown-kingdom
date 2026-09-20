import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.resolve();
const PORT = 4185;
const authProxy = process.env.AUTH_PROXY_TARGET ? new URL(process.env.AUTH_PROXY_TARGET) : null;
if (authProxy && !['http:', 'https:'].includes(authProxy.protocol)) throw new Error('Invalid auth proxy target');

const MIME_TYPES = {
  ".html": "text/html; charset=UTF-8",
  ".js": "application/javascript; charset=UTF-8",
  ".mjs": "application/javascript; charset=UTF-8",
  ".css": "text/css; charset=UTF-8",
  ".json": "application/json; charset=UTF-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith('/auth/')) {
    if (!authProxy) { res.writeHead(503); res.end('Auth proxy not configured'); return; }
    const upstream = (authProxy.protocol === 'https:' ? https : http).request(new URL(url.pathname, authProxy), {
      method: req.method,
      headers: { ...req.headers, host: authProxy.host }, timeout: 20000,
    }, response => { res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('timeout', () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Authentication unavailable'); });
    req.pipe(upstream);
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); }
  catch { res.writeHead(400); res.end('Invalid path'); return; }
  // Authentication secrets and server source must never be exposed by the local static server.
  const publicPath = /^\/(?:index\.html|privacy\.html|support\.html|styles\.css|legal\.css|app\.js|legal\.js|favicon\.ico)$/.test(pathname)
    || /^\/(?:assets|js|packages\/game-engine\/src)\//.test(pathname) || pathname === '/';
  if (!publicPath || pathname.split('/').some(segment => segment.startsWith('.'))) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if (pathname === "/") pathname = "/index.html";
  if (pathname === "/favicon.ico") pathname = "/assets/units/king.svg";

  const filePath = path.join(__dirname, pathname);
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=UTF-8" });
      res.end(`File not found: ${pathname}`);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, {
      "Content-Type": contentType,
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running at http://127.0.0.1:${PORT}/?lang=ko&preview=iphone`);
});
