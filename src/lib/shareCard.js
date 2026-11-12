// Branded share artwork for social callouts and the rewards program: the token
// preview cards' terminal look, rebuilt around the Stellar Pump lockup, a neon
// rocket tile and the detail of whatever is being shared.
import {
  FONT,
  H,
  INK,
  NEON,
  PAD,
  W,
  blobFromCanvas,
  createCanvas,
  fmtCardAmount,
  hashString,
  loadBitmap,
  mulberry32,
  roundRect,
  wrapText,
} from '@/lib/canvasKit';

const MUTED = 'rgba(242,247,244,0.45)';

function host() {
  return typeof window !== 'undefined' && window.location ? window.location.host : 'pumplaunch.app';
}

function shortWallet(address) {
  if (!address) return 'your wallet';
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function drawBackdrop(ctx, seed) {
  const rand = mulberry32(seed);
  ctx.fillStyle = '#0a0b0d';
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H * 0.5, 30, W / 2, H * 0.5, 660);
  glow.addColorStop(0, 'rgba(0,245,155,0.26)');
  glow.addColorStop(0.55, 'rgba(0,245,155,0.07)');
  glow.addColorStop(1, 'rgba(10,11,13,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(242,247,244,0.045)';
  ctx.lineWidth = 1;
  for (let x = 24; x < W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 24; y < H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }

  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(
      W / 2 + (rand() - 0.5) * 180,
      H * 0.5 + (rand() - 0.5) * 90,
      210 + i * 95 + rand() * 40,
      0,
      Math.PI * 2
    );
    ctx.strokeStyle = `rgba(0,245,155,${0.15 - i * 0.04})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawLockup(ctx, domain) {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = NEON;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText('STELLAR PUMP', PAD, 92);
  ctx.fillStyle = 'rgba(242,247,244,0.4)';
  ctx.font = `600 20px ${FONT}`;
  ctx.fillText('LAUNCH & TRADE ON STELLAR', PAD, 124);
  if (domain) {
    ctx.textAlign = 'right';
    ctx.font = `500 24px ${FONT}`;
    ctx.fillText(domain, W - PAD, 92);
    ctx.textAlign = 'left';
  }
}

// The badge from the app's own cards, bottom-left, legible over any artwork.
function drawBadge(ctx, text = 'Stellar Pump') {
  ctx.font = `600 24px ${FONT}`;
  const w = ctx.measureText(text).width + 44;
  const h = 46;
  const y = H - PAD - h;
  ctx.fillStyle = 'rgba(22,33,30,0.9)';
  roundRect(ctx, PAD, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,245,155,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, PAD + 22, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

function drawFooter(ctx) {
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(242,247,244,0.35)';
  ctx.font = `400 22px ${FONT}`;
  ctx.fillText('Launch & trade memecoins on the Stellar DEX', W - PAD, H - PAD + 2);
  ctx.textAlign = 'left';
}

function drawRocket(ctx, cx, cy, size, color) {
  const h = size;
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.5);
  ctx.quadraticCurveTo(cx + h * 0.21, cy - h * 0.18, cx + h * 0.19, cy - h * 0.02);
  ctx.lineTo(cx - h * 0.19, cy - h * 0.02);
  ctx.quadraticCurveTo(cx - h * 0.21, cy - h * 0.18, cx, cy - h * 0.5);
  ctx.closePath();
  ctx.fill();

  roundRect(ctx, cx - h * 0.19, cy - h * 0.05, h * 0.38, h * 0.42, h * 0.09);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - h * 0.19, cy + h * 0.07);
  ctx.lineTo(cx - h * 0.37, cy + h * 0.34);
  ctx.lineTo(cx - h * 0.19, cy + h * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + h * 0.19, cy + h * 0.07);
  ctx.lineTo(cx + h * 0.37, cy + h * 0.34);
  ctx.lineTo(cx + h * 0.19, cy + h * 0.3);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx - h * 0.1, cy + h * 0.34);
  ctx.lineTo(cx, cy + h * 0.56);
  ctx.lineTo(cx + h * 0.1, cy + h * 0.34);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.02, h * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0b0d';
  ctx.fill();
  ctx.restore();
}

function drawRocketTile(ctx, cx, cy, size) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.79, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,245,155,0.2)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.63, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,245,155,0.1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  const x = cx - size / 2;
  const y = cy - size / 2;
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, '#00F59B');
  gradient.addColorStop(1, '#00B877');
  roundRect(ctx, x, y, size, size, size * 0.26);
  ctx.fillStyle = gradient;
  ctx.shadowColor = 'rgba(0,245,155,0.5)';
  ctx.shadowBlur = 70;
  ctx.fill();
  ctx.shadowBlur = 0;
  drawRocket(ctx, cx, cy, size * 0.66, '#06170F');
  ctx.restore();
}

// A callout that carries a picture shares that picture, cropped square.
function drawMediaTile(ctx, bitmap, cx, cy, size) {
  const x = cx - size / 2;
  const y = cy - size / 2;
  const r = size * 0.16;
  ctx.save();
  roundRect(ctx, x, y, size, size, r);
  ctx.clip();
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  ctx.drawImage(
    bitmap,
    x + (size - bitmap.width * scale) / 2,
    y + (size - bitmap.height * scale) / 2,
    bitmap.width * scale,
    bitmap.height * scale
  );
  ctx.restore();
  ctx.save();
  roundRect(ctx, x, y, size, size, r);
  ctx.strokeStyle = 'rgba(0,245,155,0.35)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

async function renderPostCard(post, { author, handle } = {}) {
  const ctx = createCanvas().getContext('2d');
  const canvas = ctx.canvas;
  const symbol = String(post?.token_symbol || '').toUpperCase();
  drawBackdrop(ctx, hashString(`${post?.id || ''}|${post?.content || ''}|${author || ''}`));
  drawLockup(ctx, host());

  const bitmap = post?.image_url ? await loadBitmap(post.image_url) : null;
  const size = 196;
  if (bitmap && bitmap.width) drawMediaTile(ctx, bitmap, W / 2, 236, size);
  else drawRocketTile(ctx, W / 2, 236, size);

  ctx.textAlign = 'center';
  ctx.fillStyle = INK;
  ctx.font = `700 34px ${FONT}`;
  const body = (post?.content || 'Calling it on Stellar Pump').trim();
  wrapText(ctx, body, W - PAD * 4, 2).forEach((line, i) => ctx.fillText(line, W / 2, 402 + i * 44));

  const meta = [
    handle || author || 'Anonymous',
    symbol ? `$${symbol}` : null,
    post?.position_size ? `${fmtCardAmount(post.position_size)} XLM position` : null,
    post?.pnl ? `${post.pnl >= 0 ? '+' : ''}${fmtCardAmount(post.pnl)} XLM PnL` : null,
  ]
    .filter(Boolean)
    .join('  ·  ');
  ctx.fillStyle = post?.pnl < 0 ? '#ff4d6d' : MUTED;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(meta, W / 2, 488);

  drawBadge(ctx);
  drawFooter(ctx);
  ctx.textAlign = 'left';
  return blobFromCanvas(canvas);
}

function toFile(blob, name) {
  return blob ? new File([blob], name, { type: 'image/png' }) : null;
}

function toUrl(blob) {
  return blob ? URL.createObjectURL(blob) : null;
}

// The picture that rides with a post when the device can share files.
export async function postCardFile(post, opts) {
  try {
    return toFile(await renderPostCard(post, opts), `stellar-pump-callout-${post?.id || 'share'}.png`);
  } catch {
    return null;
  }
}