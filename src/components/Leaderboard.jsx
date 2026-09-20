import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '@/lib/leaderboard';

function shortAddr(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function Leaderboard({ tokens, walletAddress }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchLeaderboard(tokens);
        if (active) setRows(data);
      } catch { /* ignore */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [tokens]);

  const myRank = walletAddress ? rows.findIndex((r) => r.address === walletAddress) : -1;
  const myRow = myRank >= 0 ? rows[myRank] : null;
  const top = rows.slice(0, 50);

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <h3 className="font-bold text-sm">🏆 Top Earners</h3>
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
        </div>
      ) : top.length === 0 ? (
        <p className="text-xs text-white/30 text-center py-4">No trades yet. Be the first!</p>
      ) : (
        <div className="space-y-1">
          {top.map((r, i) => {
            const isMe = r.address === walletAddress;
            return (
              <div key={r.address} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${isMe ? 'bg-[#00ff88]/10' : ''}`}>
                <span className={`w-5 text-sm font-bold ${i < 3 ? 'text-[#00ff88]' : 'text-white/30'}`}>{i + 1}</span>
                <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-[11px] font-bold">
                  {r.address.slice(0, 1)}
                </div>
                <span className="flex-1 text-xs font-mono text-white/70 truncate">{shortAddr(r.address)}</span>
                <span className={`text-xs font-bold ${r.pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
                  {r.pnl >= 0 ? '+' : ''}{r.pnl.toFixed(2)} XLM
                </span>
              </div>
            );
          })}
          {myRow && myRank >= 50 && (
            <>
              <div className="text-center text-white/20 text-xs py-0.5">• • •</div>
              <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-[#00ff88]/10">
                <span className="w-5 text-sm font-bold text-white/60">{myRank + 1}</span>
                <div className="w-7 h-7 rounded-full bg-[#00ff88]/20 flex items-center justify-center text-[10px] font-bold">YOU</div>
                <span className="flex-1 text-xs font-mono text-white/70 truncate">{shortAddr(myRow.address)}</span>
                <span className={`text-xs font-bold ${myRow.pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
                  {myRow.pnl >= 0 ? '+' : ''}{myRow.pnl.toFixed(2)} XLM
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}