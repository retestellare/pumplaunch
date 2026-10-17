// Reads the artwork a Stellar issuer publishes for an asset in its stellar.toml —
// the same logo LOBSTR, Scopuly and the other wallets display. The lookup runs
// here because the issuer's domain answers only some browsers, and because one
// call can answer for every icon a screen shows.
const HORIZON_URL = 'https://horizon.stellar.org';
const CODE_RE = /^[A-Za-z0-9]{1,12}$/;
const ISSUER_RE = /^G[A-Z2-7]{55}$/;
const DOMAIN_RE = /^[a-zA-Z0-9.-]{3,253}$/;
const MAX_ASSETS = 40;
const CONCURRENCY = 6;

const CODE_KEYS = ['CODE', 'CURRENCY_CODE'];
const LOGO_KEYS = ['IMAGE', 'CURRENCY_LOGO', 'LOGO'];
const NAME_KEYS = ['NAME', 'CURRENCY_NAME'];

// Warm instances reuse an answer instead of asking Horizon again.
const cache = new Map();

const keyOf = (code, issuer) => `${code.toUpperCase()}:${issuer}`;

// Issuers write the artwork as a full URL, as a bare host, or as a path on their
// own domain; all three have to become something an image can load.
function absoluteLogo(value, base) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  if (raw.startsWith('/')) {
    try {
      return new URL(raw, base).toString();
    } catch {
      return null;
    }
  }
  return `https://${raw}`;
}

// SEP-1 spells the fields both long (CURRENCY_CODE/CURRENCY_LOGO) and short
// (code/image, what most Stellar tooling writes), so both are read.
function parseCurrency(toml, code) {
  const lines = toml.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '[[CURRENCIES]]') continue;
    let blockCode = null;
    let logo = null;
    let name = null;
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j].trim();
      if (line.startsWith('[')) break;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const field = line.slice(0, eq).trim().toUpperCase();
      const value = line
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
        .trim();
      if (CODE_KEYS.includes(field)) blockCode = value;
      else if (LOGO_KEYS.includes(field)) logo = value;
      else if (NAME_KEYS.includes(field)) name = value;
    }
    if (blockCode && blockCode.toUpperCase() === code.toUpperCase()) return { logo, name };
  }
  return null;
}

// A published path is not always an image — a domain written in place of one
// resolves to a page, which would render as a broken box. Only real images pass.
async function servesImage(url) {
  try {
    const res = await fetch(url, {
      headers: { Range: 'bytes=0-64' },
      signal: AbortSignal.timeout(8000),
    });
    const type = res.headers.get('content-type') || '';
    try {
      await res.body?.cancel();
    } catch {
      /* already closed */
    }
    return type.startsWith('image/');
  } catch {
    return false;
  }
}

async function homeDomainOf(issuer) {
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${issuer}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const account = await res.json();
    return account.home_domain || null;
  } catch {
    return null;
  }
}

async function resolveAsset(code, issuer, homeDomain) {
  const key = keyOf(code, issuer);
  if (cache.has(key)) return cache.get(key);

  const answer = (async () => {
    let domain = homeDomain && DOMAIN_RE.test(homeDomain) ? homeDomain : null;
    if (!domain) domain = await homeDomainOf(issuer);
    if (!domain || !DOMAIN_RE.test(domain)) return null;

    const base = `https://${domain.replace(/\/$/, '')}`;
    let toml = null;
    try {
      const res = await fetch(`${base}/.well-known/stellar.toml`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) toml = await res.text();
    } catch {
      return null;
    }
    if (!toml) return null;

    const parsed = parseCurrency(toml, code);
    if (!parsed) return null;

    const logo = absoluteLogo(parsed.logo, base);
    const usable = logo && (await servesImage(logo));
    return {
      code: code.toUpperCase(),
      issuer,
      homeDomain: domain,
      name: parsed.name || null,
      logo: usable ? logo : null,
    };
  })();

  cache.set(key, answer);
  return answer;
}

export default async function (req) {
  try {
    if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

    const body = await req.json().catch(() => ({}));
    const requested = Array.isArray(body?.assets) ? body.assets.slice(0, MAX_ASSETS) : [];

    const wanted = [];
    for (const item of requested) {
      const code = String(item?.code || '').trim();
      const issuer = String(item?.issuer || '').trim();
      if (!CODE_RE.test(code) || !ISSUER_RE.test(issuer)) continue;
      wanted.push({ code, issuer, homeDomain: item?.homeDomain ? String(item.homeDomain).trim() : null });
    }

    const logos = {};
    for (let i = 0; i < wanted.length; i += CONCURRENCY) {
      const wave = wanted.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        wave.map(({ code, issuer, homeDomain }) => resolveAsset(code, issuer, homeDomain))
      );
      wave.forEach(({ code, issuer }, index) => {
        const result = results[index];
        if (result.status === 'fulfilled' && result.value) logos[keyOf(code, issuer)] = result.value;
      });
    }

    return Response.json({ logos });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}