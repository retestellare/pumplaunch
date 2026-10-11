// Candlesticks for on-chain fills. One window per timeframe, one bucket per
// candle: a bucket the asset barely traded in simply has no candle, so nothing
// is invented to fill the chart.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const TIMEFRAMES = [
  { key: '1d', label: '1D', windowMs: DAY, bucketMs: HOUR },
  { key: '1w', label: '1W', windowMs: 7 * DAY, bucketMs: 6 * HOUR },
  { key: '1mo', label: '1M', windowMs: 30 * DAY, bucketMs: DAY },
  { key: '1y', label: '1Y', windowMs: 365 * DAY, bucketMs: 7 * DAY },
];

export function timeframeOf(key) {
  return TIMEFRAMES.find((t) => t.key === key) || TIMEFRAMES[0];
}

// Open, high, low, close and traded XLM per bucket, oldest first. `avg` is the
// mean close, which is the dashed reference line the chart draws.
export function buildCandles(fills, timeframe) {
  const { windowMs, bucketMs } = timeframe;
  const cutoff = Date.now() - windowMs;
  const buckets = new Map();

  for (const f of fills || []) {
    const time = new Date(f.time).getTime();
    if (!time || time < cutoff) continue;
    const key = Math.floor(time / bucketMs) * bucketMs;
    const candle = buckets.get(key);
    if (!candle) {
      buckets.set(key, { t: key, o: f.price, h: f.price, l: f.price, c: f.price, volume: f.xlm });
      continue;
    }
    candle.h = Math.max(candle.h, f.price);
    candle.l = Math.min(candle.l, f.price);
    candle.c = f.price;
    candle.volume += f.xlm;
  }

  const candles = [...buckets.values()].sort((a, b) => a.t - b.t);
  const avg = candles.length ? candles.reduce((sum, c) => sum + c.c, 0) / candles.length : 0;
  return { candles, avg };
}

// Prices span nine orders of magnitude here, so the scale decides the decimals.
export function formatPrice(price) {
  const p = parseFloat(price);
  if (!p || p <= 0 || isNaN(p)) return '—';
  if (p >= 1) return p.toFixed(4);
  if (p >= 0.001) return p.toFixed(6);
  return p.toFixed(8);
}

export function formatAmount(n, max = 2) {
  const v = parseFloat(n) || 0;
  if (v >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: max });
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// The shortest window that actually holds a chart, so a quiet token still opens
// on candles instead of an empty box.
export function defaultTimeframe(fills) {
  for (const t of TIMEFRAMES) {
    if (buildCandles(fills, t).candles.length > 1) return t.key;
  }
  return TIMEFRAMES[0].key;
}

// Axis labels: clock times inside a day, dates beyond it.
export function formatBucket(time, key) {
  const d = new Date(time);
  if (key === '1d') return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}