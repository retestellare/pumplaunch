// Automatic social preview cards. Every token gets its own 1200x630 image,
// drawn on a canvas from a hash of its symbol: the palette, the background
// shapes and the logo all follow the token, so no two cards look alike.
// The PNG is uploaded once to public storage and remembered on the token.
import { base44 } from '@/api/base44Client';
import { FONT, H, PAD, W, hashString, loadBitmap, mulberry32, roundRect, wrapText } from '@/lib/canvasKit';

const cache = new Map(); // token id -> { url, file, blob }
const inflight = new Map(); // token id -> promise

function fmtPrice(value) {
  const v = parseFloat(value);
  if (!v || v <= 0 || isNaN(v)) return '—';
  return `${v < 0.0001 ? v.toExponential(2) : v.toFixed(6)} XLM`;
}

function fmtAmount(value) {
  const v = parseFloat(value);
  if (!v || isNaN(v)) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(2);
}

function drawLogo(ctx, x, y, size, bitmap, symbol, hue, second) {
  const r = size * 0.26;
  ctx.save();
  roundRect(ctx, x, y, size, size, r);
  ctx.clip();
  if (bitmap && bitmap.width) {
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, x + (size - w) / 2, y + (size - h) / 2, w, h);
  } else {
    const g = ctx.createLinearGradient(x, y, x + size, y + size);
    g.addColorStop(0, `hsl(${hue}, 95%, 55%)`);
    g.addColorStop(1, `hsl(${second}, 95%, 45%)`);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#06100b';
    ctx.font = `800 ${Math.round(size * 0.48)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((symbol || '?').slice(0, 1).toUpperCase(), x + size / 2, y + size / 2 + size * 0.04);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, size, size, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

function drawCard(ctx, token, stats, bitmap, seed) {
  const rand = mulberry32(seed);
  const hue = seed % 360;
  const second = (hue + 70 + ((seed >>> 9) % 200)) % 360;
  const symbol = (token.symbol || '').toUpperCase();

  ctx.fillStyle = '#0a0b0d';
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createLinearGradient(0, 0, W, H);
  glow.addColorStop(0, `hsla(${hue}, 90%, 55%, 0.65)`);
  glow.addColorStop(0.55, `hsla(${second}, 90%, 50%, 0.32)`);
  glow.addColorStop(1, 'rgba(10,11,13,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(rand() * W, rand() * H, 120 + rand() * 260, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${i % 2 ? hue : second}, 95%, 65%, ${0.1 + rand() * 0.12})`;
    ctx.lineWidth = 2 + rand() * 6;
    ctx.stroke();
  }

  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.translate(rand() * W - 300, -150);
  ctx.rotate(-0.45);
  ctx.fillStyle = `hsl(${second}, 95%, 60%)`;
  ctx.fillRect(0, 0, 420 + rand() * 480, H + 500);
  ctx.restore();

  // Keep the neon readable and the text legible.
  ctx.fillStyle = 'rgba(10,11,13,0.52)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 32px ${FONT}`;
  ctx.fillStyle = '#00ff88';
  ctx.fillText('STELLAR PUMP', PAD, 88);

  const domain = typeof window !== 'undefined' && window.location ? window.location.host : '';
  if (domain) {
    ctx.textAlign = 'right';
    ctx.font = `500 24px ${FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fillText(domain, W - PAD, 86);
    ctx.textAlign = 'left';
  }

  const logoSize = 168;
  drawLogo(ctx, PAD, 150, logoSize, bitmap, symbol, hue, second);

  const textX = PAD + logoSize + 40;
  const textWidth = W - textX - PAD;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(`$${symbol}`.slice(0, 14), textX, 244);
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.font = `600 38px ${FONT}`;
  ctx.fillText(String(token.name || 'New memecoin').slice(0, 30), textX, 296);
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.font = `400 26px ${FONT}`;
  const description = token.description || 'A new memecoin on Stellar.';
  wrapText(ctx, description, textWidth, 2).forEach((line, i) => {
    ctx.fillText(line, textX, 344 + i * 34);
  });

  const price = stats.price ?? token.price;
  const marketCap = stats.marketCap ?? token.market_cap;
  const holders = stats.holders ?? token.holders;
  const columns = [
    { label: 'PRICE', value: fmtPrice(price) },
    { label: 'MARKET CAP', value: marketCap ? `${fmtAmount(marketCap)} XLM` : '—' },
    { label: 'HOLDERS', value: holders != null ? String(holders) : '—' },
  ];
  const colWidth = (W - PAD * 2) / columns.length;
  columns.forEach((col, i) => {
    const x = PAD + i * colWidth;
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(col.label, x, 478);
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillText(col.value, x, 522);
  });

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 200px ${FONT}`;
  ctx.fillText(`$${symbol}`, W - 30, H - 40);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.34)';
  ctx.font = `400 24px ${FONT}`;
  ctx.fillText('Launch & trade memecoins on the Stellar DEX', PAD, H - 48);

  // Corner watermark: a dark pill keeps the label legible over any token logo
  // or glow colour. Drawn last so it sits above the faint symbol fill.
  const mark = 'launched on Stellar Pump';
  ctx.font = `600 22px ${FONT}`;
  const markW = ctx.measureText(mark).width + 34;
  const markH = 40;
  const markX = W - PAD - markW;
  const markY = H - 57 - markH / 2;
  ctx.fillStyle = 'rgba(10,11,13,0.55)';
  roundRect(ctx, markX, markY, markW, markH, markH / 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(mark, markX + 17, markY + markH / 2 + 1);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

async function renderCard(token, stats) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const seed = hashString(`${token.symbol || ''}|${token.name || ''}|${token.issuer || token.id || ''}`);
  const bitmap = token.image_url ? await loadBitmap(token.image_url) : null;
  drawCard(ctx, token, stats, bitmap, seed);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not render the preview card');
  return blob;
}

// Best-effort fetch of an already-uploaded card, so a returning visitor can
// still share the image itself rather than only the link.
async function fileFromUrl(url, symbol) {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new File([blob], `${(symbol || 'token').toLowerCase()}-preview.png`, { type: 'image/png' });
  } catch {
    return null;
  }
}

export async function generateOgCard(token, stats = {}) {
  const blob = await renderCard(token, stats);
  const file = new File([blob], `${(token.symbol || 'token').toLowerCase()}-preview.png`, {
    type: 'image/png',
  });
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  await base44.entities.Token.update(token.id, { og_image_url: file_url });
  const entry = { url: file_url, file, blob };
  cache.set(token.id, entry);
  return entry;
}

// Returns the card for a token, generating it once if it does not exist yet.
export async function ensureOgCard(token, stats = {}) {
  if (!token?.id || typeof document === 'undefined') return null;
  if (cache.has(token.id)) return cache.get(token.id);
  if (token.og_image_url) {
    const file = await fileFromUrl(token.og_image_url, token.symbol);
    const entry = { url: token.og_image_url, file, blob: null };
    cache.set(token.id, entry);
    return entry;
  }
  if (inflight.has(token.id)) return inflight.get(token.id);
  const task = generateOgCard(token, stats).finally(() => inflight.delete(token.id));
  inflight.set(token.id, task);
  return task;
}