// Sharing through the Web Share API: phones get their own native share sheet,
// and anywhere it isn't available the message is copied to the clipboard.
export const APP_NAME = 'Stellar Pump';

export function canWebShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export function absoluteUrl(path) {
  const origin = typeof window !== 'undefined' && window.location ? window.location.origin : '';
  return `${origin}${path}`;
}

export function tokenShareUrl(token) {
  return absoluteUrl(`/token/${token?.id ?? ''}`);
}

function fmtPrice(price) {
  const p = parseFloat(price);
  if (!p || p <= 0 || isNaN(p)) return null;
  return `${p.toFixed(8)} XLM`;
}

function fmtPct(change) {
  if (change == null || isNaN(change)) return null;
  return `${change >= 0 ? '+' : ''}${Number(change).toFixed(2)}%`;
}

function fmtAmount(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function tokenShare({ token, price, change24h }) {
  const stats = [fmtPrice(price), fmtPct(change24h) && `${fmtPct(change24h)} in 24h`].filter(Boolean).join(' · ');
  return {
    title: `$${token.symbol} on ${APP_NAME}`,
    text: `${token.name}${stats ? ` — ${stats}` : ''}. Trade $${token.symbol} on the Stellar DEX.`,
    url: tokenShareUrl(token),
  };
}

export function tradeShare({ token, side, quoteLabel, amount, received }) {
  const buying = side === 'buy';
  const what = buying
    ? `${fmtAmount(received)} $${token.symbol} for ${fmtAmount(amount)} ${quoteLabel}`
    : `${fmtAmount(amount)} $${token.symbol} for ${fmtAmount(received)} ${quoteLabel}`;
  return {
    title: `My $${token.symbol} trade on ${APP_NAME}`,
    text: `🔥 Just ${buying ? 'bought' : 'sold'} ${what} on ${APP_NAME}.`,
    url: tokenShareUrl(token),
  };
}

export function launchShare({ id, symbol, name }) {
  return {
    title: `$${symbol} just launched`,
    text: `🚀 I just launched $${symbol}${name ? ` (${name})` : ''} on ${APP_NAME} — now trading on the Stellar DEX.`,
    url: tokenShareUrl({ id }),
  };
}

// Returns 'shared' | 'copied' | 'cancelled' | 'failed' so callers can decide
// whether a follow-up message is needed.
export async function sharePayload({ title, text, url, toast }) {
  if (canWebShare()) {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // Anything else (unsupported payload, share blocked) falls back to copying.
    }
  }
  return copyShare({ text, url, toast });
}

export async function copyShare({ text, url, toast }) {
  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join(' '));
    toast?.({ title: 'Copied to clipboard', description: 'Paste it anywhere to share.' });
    return 'copied';
  } catch {
    toast?.({ title: 'Could not share', description: 'Copy the link from your browser instead.', variant: 'destructive' });
    return 'failed';
  }
}