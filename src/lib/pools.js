// Dual-pool support: a token can trade against XLM, against USDC, or against
// both at once. Every screen converts its figures to XLM so market caps, PnL
// and rankings compare like for like.
export const USDC_CODE = 'USDC';
export const USDC_ISSUER = 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN';

export const QUOTES = {
  xlm: { key: 'xlm', label: 'XLM', color: '#00ff88' },
  usdc: { key: 'usdc', label: 'USDC', color: '#3b82f6' },
};

export const POOL_TYPES = [
  {
    value: 'xlm',
    label: 'Single Pool (XLM)',
    desc: 'Trade against XLM only. Bonding curve or liquidity pool.',
    pools: ['xlm'],
  },
  {
    value: 'usdc',
    label: 'Single Pool (USDC)',
    desc: 'Trade against USDC only. Liquidity pool launch.',
    pools: ['usdc'],
  },
  {
    value: 'dual',
    label: 'Dual Pool (XLM & USDC)',
    desc: 'Both pools at once — deep liquidity from two sides.',
    pools: ['xlm', 'usdc'],
  },
];

export function quoteOf(key) {
  return QUOTES[key] || QUOTES.xlm;
}

// Which markets a token has. Records written before dual pools existed carry no
// field and are XLM-only.
export function tokenPools(token) {
  const stored = token?.pools;
  if (Array.isArray(stored) && stored.length) {
    const valid = stored.filter((k) => QUOTES[k]);
    if (valid.length) return valid;
  }
  return ['xlm'];
}

export function isDualToken(token) {
  return tokenPools(token).length > 1;
}

// A pool launch puts the whole supply into the pool and skips the bonding curve.
export function isPoolType(poolType) {
  return tokenPools({ pools: POOL_TYPES.find((p) => p.value === poolType)?.pools }).includes('usdc');
}

export function poolsForType(poolType) {
  return POOL_TYPES.find((p) => p.value === poolType)?.pools || ['xlm'];
}

export function poolLabel(pools) {
  const list = Array.isArray(pools) ? pools : tokenPools({ pools });
  if (list.includes('xlm') && list.includes('usdc')) return 'XLM + USDC';
  return list.includes('usdc') ? 'USDC' : 'XLM';
}

// XLM is the unit of account for every figure the app displays.
export function toXlm(amount, quote, xlmPerUsdc = 0) {
  const n = parseFloat(amount) || 0;
  if (quote !== 'usdc') return n;
  return xlmPerUsdc > 0 ? n * xlmPerUsdc : 0;
}

export function fromXlm(amountXlm, quote, xlmPerUsdc = 0) {
  const n = parseFloat(amountXlm) || 0;
  if (quote !== 'usdc') return n;
  return xlmPerUsdc > 0 ? n / xlmPerUsdc : 0;
}