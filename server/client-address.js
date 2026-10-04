import { BlockList, isIP } from 'node:net';

const privatePeers = new BlockList();
privatePeers.addSubnet('127.0.0.0', 8);
privatePeers.addAddress('::1', 'ipv6');
privatePeers.addSubnet('10.0.0.0', 8);
privatePeers.addSubnet('172.16.0.0', 12);
privatePeers.addSubnet('192.168.0.0', 16);
privatePeers.addSubnet('fc00::', 7, 'ipv6');

export function normalizeAddress(value) {
  if (typeof value !== 'string') return null;
  let address = value.trim().toLowerCase();
  if (address.startsWith('::ffff:') && isIP(address.slice(7)) === 4) address = address.slice(7);
  const family = isIP(address);
  if (!family || address.includes('%')) return null;
  if (family === 4) return address;
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1);
  const mapped = /^::ffff:([0-9a-f]+):([0-9a-f]+)$/.exec(canonical);
  if (mapped) {
    const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return canonical;
}

export function requestClient(req, { renderProxy = false } = {}) {
  const peer = normalizeAddress(req.socket.remoteAddress);
  const family = isIP(peer || '');
  // Only Render's internal ingress may supply Cloudflare's overwritten header.
  // Never select a caller-controlled entry from X-Forwarded-For.
  const trustedPeer = renderProxy && family && privatePeers.check(peer, family === 6 ? 'ipv6' : 'ipv4');
  const visitor = trustedPeer ? normalizeAddress(req.headers['cf-connecting-ip']) : null;
  return { address: visitor || peer || 'unknown', source: visitor ? 'render-client' : 'socket-peer' };
}

export function ingressSummary(req) {
  const peer = normalizeAddress(req.socket.remoteAddress);
  const classify = value => {
    const address = normalizeAddress(value);
    if (!address) return value === undefined ? 'missing' : 'invalid';
    if (address === '::1' || address.startsWith('127.')) return 'loopback';
    return privatePeers.check(address, isIP(address) === 6 ? 'ipv6' : 'ipv4') ? 'private' : 'public';
  };
  const forwarded = typeof req.headers['x-forwarded-for'] === 'string'
    ? req.headers['x-forwarded-for'].split(',').slice(-8) : [];
  return { peer: classify(peer), cf: classify(req.headers['cf-connecting-ip']),
    trueClient: classify(req.headers['true-client-ip']), xReal: classify(req.headers['x-real-ip']),
    forwarded: forwarded.map(classify), forwardedPeerLast: normalizeAddress(forwarded.at(-1)) === peer,
    cfRay: typeof req.headers['cf-ray'] === 'string' };
}
