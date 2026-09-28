import { useState, useEffect } from 'react';
import { fetchLeaderboard } from '@/lib/leaderboard';
import { resolveProfiles, displayName, shortAddr } from '@/lib/profiles';
import Avatar from '@/components/Avatar';

function formatPct(pct) {
  if (pct == null) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

export default function Leaderboard({ tokens, walletAddress }) {
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchLeaderboard(tokens.slice(0, 12));
        if (!active) return;
        setRows(data);
        const pmap = await resolveProfiles(data.map((r) => r.address));
        if (active) setProfiles(pmap);
      } catch { /* ignore */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [tokens]);

  const myRank = walletAddress ? rows.findIndex((r) => r.address === walletAddress) : -1;
  const myRow = myRank >= 0 ? rows[myRank] : null;
  const top = rows.slice(0, 50);

  const renderRow = (r, i, isMe) => {
    const profile = profiles[r.address];
    const name = displayName(profile, r.address);
    const positive = r.pnl >= 0;
    const pctPositive = r.gainPct == null ? positive : r.gainPct >= 0;
    return (
      <div key={r.address} className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg ${isMe ? 'bg-[#00ff88]/10' : ''}`}>
        <span className={`w-5 text-sm font-bold ${i < 3 ? 'text-[#00ff88]' : 'text-white/30'}`}>{i + 1}</span>
        <Avatar profile={profile} address={r.address} size={28} />
        <span className="flex-1 text-xs font-medium text-white/80 truncate">
          {profile?.display_name ? name : shortAddr(r.address)}
        </span>
        <div className="text-right">
          <div className={`text-xs font-bold ${pctPositive ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
            {formatPct(r.gainPct)}
          </div>
          <div className={`text-[10px] ${positive ? 'text-[#00ff88]/70' : 'text-[#ff3b5c]/70'}`}>
            {positive ? '+' : ''}{r.pnl.toFixed(2)} XLM
          </div>
        </div>
      </div>
    );
  };

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
          {top.map((r, i) => renderRow(r, i, r.address === walletAddress))}
          {myRow && myRank >= 50 && (
            <>
              <div className="text-center text-white/20 text-xs py-0.5">• • •</div>
              {renderRow(myRow, myRank, true)}
            </>
          )}
        </div>
      )}
    </div>
  );
}