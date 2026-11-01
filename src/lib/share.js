// Sharing through the Web Share API: phones get their own native share sheet,
// and anywhere it isn't available the app opens its own share picker.
import { openShareSheet } from '@/lib/shareSheet';

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

// The rewards page doubles as the referral landing: the inviter's wallet rides
// in the query so the invited member is credited to them.
export function rewardsRefUrl(wallet) {
  return absoluteUrl(`/rewards${wallet ? `?ref=${wallet}` : ''}`);
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

export function postShare({ post, author }) {
  const body = (post?.content || '').trim();
  const snippet = body.length > 140 ? `${body.slice(0, 139).trimEnd()}…` : body;
  const symbol = post?.token_symbol ? `$${post.token_symbol}` : '';
  return {
    title: symbol ? `${symbol} on ${APP_NAME}` : `Post on ${APP_NAME}`,
    text: [snippet, symbol && `📈 ${symbol}`, author].filter(Boolean).join(' · '),
    url: absoluteUrl(`/profile/${post?.author ?? ''}`),
  };
}

// Hands the message to the device's own share sheet.
// Returns 'shared' | 'cancelled' | 'failed'; `imageFile` (a generated preview
// card, mint artwork) rides along when the device can share files.
export async function nativeShare({ title, text, url, imageFile }) {
  if (!canWebShare()) return 'failed';
  try {
    const files = imageFile ? [imageFile] : null;
    if (files && navigator.canShare?.({ files })) {
      await navigator.share({ title, text: `${text} ${url}`, files });
      return 'shared';
    }
    await navigator.share({ title, text, url });
    return 'shared';
  } catch (e) {
    return e?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

// Returns 'shared' | 'cancelled' | 'sheet' so callers can decide whether a
// follow-up message is needed. With no device sheet (or one that refuses the
// payload) the app's own picker opens instead of silently copying.
export async function sharePayload({ title, text, url, imageFile }) {
  const outcome = await nativeShare({ title, text, url, imageFile });
  if (outcome !== 'failed') return outcome;
  openShareSheet({ title, text, url, imageFile });
  return 'sheet';
}

// Which edition a purchase claimed, so the post and the UI agree on the number.
export function mintedEditionNumber(collection, edition) {
  const total = Math.max(1, collection?.total_supply || 1);
  return Math.min(total, edition || collection?.minted_count || 1);
}

function shorten(text, max = 150) {
  const body = (text || '').trim();
  return body.length > max ? `${body.slice(0, max - 1).trimEnd()}…` : body;
}

// A mint is a purchase worth bragging about, so the collection's own
// description travels with the message.
export function nftMintShare({ collection, edition }) {
  const total = Math.max(1, collection?.total_supply || 1);
  const number = mintedEditionNumber(collection, edition);
  const price = parseFloat(collection?.mint_price) || 0;
  const quote = String(collection?.quote || 'xlm').toUpperCase();
  return {
    title: `${collection?.name} — edition #${number}`,
    text: [
      `🔥 Just minted edition #${number} of ${total} — ${collection?.name} ($${collection?.symbol})`,
      price > 0 ? `Minted for ${price.toLocaleString()} ${quote} on the Stellar DEX` : null,
      shorten(collection?.description),
    ]
      .filter(Boolean)
      .join('\n'),
    url: absoluteUrl('/'),
  };
}

// Pulls the artwork off the collection so the native share sheet can send the
// actual picture with the post. Cross-origin art the browser refuses to hand
// over just means the message goes without it.
export async function imageFileFromUrl(url, filename) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/')) return null;
    const ext = blob.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    return new File([blob], filename || `artwork.${ext}`, { type: blob.type });
  } catch {
    return null;
  }
}

export function xShareUrl({ text, url }) {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function telegramShareUrl({ text, url }) {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
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

// The daily free drop is public proof the platform pays out, so the receipt is
// written to be posted as-is.
export function plunchDropShare({ amount }) {
  const label = (parseFloat(amount) || 0).toLocaleString('en-US');
  return {
    title: `Free ${label} PLUNCH drop`,
    text: `🚀 Just collected ${label} free PLUNCH from the daily drop on ${APP_NAME}. Claim yours every 24 hours.`,
    url: absoluteUrl('/'),
  };
}