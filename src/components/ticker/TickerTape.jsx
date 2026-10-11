import { cn } from '@/lib/utils';

/**
 * Continuous horizontal tape. The track holds two copies of the row and slides
 * by half its width, so the loop never shows a seam. `duration` is the seconds
 * one pass takes; `reverse` sends the row the other way.
 */
export default function TickerTape({ children, duration = 30, reverse = false, className }) {
  const items = Array.isArray(children) ? children : [children];
  if (items.length === 0) return null;

  return (
    <div className={cn('relative overflow-hidden pointer-events-none select-none', className)}>
      <div
        className={cn('sp-tape', reverse && 'sp-tape-reverse')}
        style={{ '--tape-duration': `${duration}s` }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center shrink-0" aria-hidden={copy === 1}>
            {items.map((item, i) => (
              <span key={i} className="flex items-center">
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}