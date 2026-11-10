// ─────────────────────────────────────────────────────────────────────────────
// Network identity for the faucet.
//
// Only headers the platform's own edge sets are read, because a caller can put
// anything into X-Forwarded-For. The address itself is never stored: it is
// reduced to a network (an IPv6 /64, or the IPv4 address) and turned into a
// keyed, one-way hash, so claim records can be matched per connection without
// keeping personal data.
// ─────────────────────────────────────────────────────────────────────────────

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

function normalize(ip) {
  let value = String(ip || '').trim().toLowerCase();
  if (value.startsWith('::ffff:') && IPV4.test(value.slice(7))) value = value.slice(7);
  if (IPV4.test(value)) return value;
  if (value.includes(':')) {
    // Mobile carriers rotate the address inside one /64 and a phone can change
    // address on every reconnect, so the /64 is what identifies the connection.
    const prefix = value.split(':').slice(0, 4).join(':');
    return `${prefix}::/64`;
  }
  return '';
}

export function clientNetwork(req) {
  const headers = req.headers;
  const direct = (headers.get('cf-connecting-ip') || headers.get('x-real-ip') || '').trim();
  if (direct) return normalize(direct);

  const hops = (headers.get('x-forwarded-for') || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  // The last hop is the one the platform's proxy appended.
  return hops.length ? normalize(hops[hops.length - 1]) : '';
}

// A keyed hash so the stored value cannot be reversed or rainbow-looked-up.
export async function networkHash(req, key) {
  const network = clientNetwork(req);
  if (!network) return null;

  const encoder = new TextEncoder();
  const hmacKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', hmacKey, encoder.encode(`plunch-network:${network}`));
  return Array.from(new Uint8Array(signature).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');
}