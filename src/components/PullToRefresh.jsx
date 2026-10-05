import { Loader2 } from 'lucide-react';
import usePullToRefresh, { PULL_THRESHOLD } from '@/hooks/usePullToRefresh';

// Drop this in as the first child of a page: it renders only the floating
// indicator below the header, so the page's own layout stays untouched.
export default function PullToRefresh({ onRefresh, enabled = true }) {
  const { pull, refreshing, ready } = usePullToRefresh(onRefresh, enabled);
  if (!refreshing && pull <= 0) return null;

  const progress = Math.min(1, pull / PULL_THRESHOLD);

  return (
    <div
      className="fixed left-0 right-0 z-40 max-w-lg mx-auto flex justify-center pointer-events-none"
      style={{ top: 'calc(3.75rem + env(safe-area-inset-top))' }}
    >
      <div
        className="flex items-center gap-2 bg-[#141518] border border-white/10 rounded-full px-4 py-2 text-xs text-white/70 shadow-lg"
        style={{
          transform: `translateY(${refreshing ? 0 : pull}px)`,
          opacity: refreshing ? 1 : progress,
        }}
      >
        <Loader2
          size={14}
          className={`text-[#00ff88] ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${Math.round(progress * 180)}deg)` }}
        />
        <span>{refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}</span>
      </div>
    </div>
  );
}