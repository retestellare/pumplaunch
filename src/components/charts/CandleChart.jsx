import { formatBucket, formatPrice } from '@/lib/candles';

const UP = '#00ff88';
const DOWN = '#ff3b5c';
const AVG = '#3b82f6';

// Candles are drawn in a stretched 0-100 viewBox, so anything that has to stay
// legible — price levels, times, the current price tag — is HTML layered over
// the SVG instead of text inside it.
export default function CandleChart({ candles, avg, height = 170, timeKey = '1d', lastPrice }) {
  if (!candles || candles.length < 2) return null;

  const highs = Math.max(...candles.map((c) => c.h));
  const lows = Math.min(...candles.map((c) => c.l));
  const pad = (highs - lows) * 0.1 || highs * 0.05 || 1;
  const min = Math.max(0, lows - pad);
  const max = highs + pad;
  const range = max - min || 1;
  const y = (price) => 100 - ((price - min) / range) * 100;

  const step = 100 / candles.length;
  const bodyWidth = Math.max(step * 0.6, 0.35);
  const last = candles[candles.length - 1];
  const current = lastPrice > 0 ? lastPrice : last.c;
  const currentUp = current >= last.o;

  const levels = [0, 0.33, 0.66, 1].map((f) => ({ top: f * 100, price: max - f * range }));

  return (
    <div>
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
          {levels.map((l) => (
            <line
              key={l.top}
              x1="0"
              x2="100"
              y1={l.top}
              y2={l.top}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {avg > 0 && (
            <line
              x1="0"
              x2="100"
              y1={y(avg)}
              y2={y(avg)}
              stroke={AVG}
              strokeWidth="1"
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {candles.map((c, i) => {
            const x = step * (i + 0.5);
            const up = c.c >= c.o;
            const color = up ? UP : DOWN;
            return (
              <g key={c.t}>
                <line
                  x1={x}
                  x2={x}
                  y1={y(c.h)}
                  y2={y(c.l)}
                  stroke={color}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <rect
                  x={x - bodyWidth / 2}
                  y={y(Math.max(c.o, c.c))}
                  width={bodyWidth}
                  height={Math.max(Math.abs(y(c.o) - y(c.c)), 0.5)}
                  fill={color}
                />
              </g>
            );
          })}
          <line
            x1="0"
            x2="100"
            y1={y(current)}
            y2={y(current)}
            stroke={currentUp ? UP : DOWN}
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {levels.map((l) => (
          <span
            key={l.top}
            className="absolute left-0 -translate-y-1/2 text-[10px] text-white/30 bg-[#141518]/80 px-1"
            style={{ top: `${l.top}%` }}
          >
            {formatPrice(l.price)}
          </span>
        ))}
        {avg > 0 && (
          <span
            className="absolute left-0 -translate-y-1/2 text-[10px] font-bold px-1"
            style={{ top: `${y(avg)}%`, color: AVG, background: 'rgba(20,21,24,0.8)' }}
          >
            Avg
          </span>
        )}
        <span
          className="absolute right-0 -translate-y-1/2 text-[10px] font-bold text-black px-1.5 py-0.5 rounded"
          style={{ top: `${y(current)}%`, background: currentUp ? UP : DOWN }}
        >
          {formatPrice(current)}
        </span>
      </div>

      <div className="flex justify-between mt-1 text-[10px] text-white/30">
        <span>{formatBucket(candles[0].t, timeKey)}</span>
        <span>{formatBucket(candles[Math.floor(candles.length / 2)].t, timeKey)}</span>
        <span>{formatBucket(last.t, timeKey)}</span>
      </div>
    </div>
  );
}