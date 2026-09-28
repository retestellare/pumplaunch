import { useState, useEffect } from 'react';
import { fetchNewHolders } from '@/lib/leaderboard';

function shortAddr(addr) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function NewHoldersToday({ tokens }) {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        // Limit work to the 12 most recent tokens for fast load
        const data = await fetchNewHolders(tokens.slice(0, 12));
        if (active) setHolders(data);
      } catch { /* ignore */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [tokens]);

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <h3 className="font-bold text-sm">🆕 New Holders Today</h3>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
        </div>
      ) : holders.length === 0 ? (
        <p className="text-xs text-white/30 text-center py-2">No new holders in the last 24h.</p>
      ) : (
        <div className="space-y-1">
          {holders.map((h, i) => (
            <div key={h.address + i} className="flex items-center gap-2.5 px-1 py-1.5">
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold">
                {h.address.slice(0, 1)}
              </div>
              <span className="text-xs font-mono text-white/70">{shortAddr(h.address)}</span>
              <span className="text-xs text-white/40">bought</span>
              <span className="flex-1 text-right text-xs font-bold text-[#00ff88] truncate">
                {h.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${h.tokenSymbol}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}