import { useState, useEffect, useMemo } from 'react';
import { fetchLeaderboard } from '@/lib/leaderboard';
import { resolveProfiles, displayName, shortAddr } from '@/lib/profiles';
import { BADGES, BADGE_ORDER, computeBadges } from '@/lib/badges';
import Avatar from '@/components/Avatar';
import TraderBadges from '@/components/TraderBadges';

function formatPct(pct) {
  if (pct == null || isNaN(pct)) return '—';
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function SkeletonRows() {
  return (
    <div className="space-y-1.5 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-1.5 py-1.5">
          <div className="w-5 h-2.5 rounded bg-[#16211E]" />
          <div className="w-7 h-7 rounded-full bg-[#16211E]" />
          <div className="flex-1 h-2.5 rounded bg-[#16211E]" />
          <div className="w-12 h-2.5 rounded bg-[#16211E]" />
        </div>
      ))}
    </div>
  );
}

export default function Leaderboard({ tokens, walletAddress }) {
  const [rows, setRows] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [loading, setLoading] = useState(true);

  // Keyed on the token set, not the array identity, so live enrichment updates
  // on Home don't trigger a refetch on every token.
  const tokenKey = tokens.map((t) => t.id).join(',');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchLeaderboard(tokens);
        if (!active) return;
        setRows(data);
        const pmap = await resolveProfiles(data.map((r) => r.address));
        if (active) setProfiles(pmap);
      } catch { /* ignore */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [tokenKey]);

  const myRank = walletAddress ? rows.findIndex((r) => r.address === walletAddress) : -1;
  const myRow = myRank >= 0 ? rows[myRank] : null;
  const top = rows.slice(0, 50);
  const badges = useMemo(() => computeBadges(rows), [rows]);

  const renderRow = (r, i, isMe) => {
    const profile = profiles[r.address];
    const name = displayName(profile, r.address);
    const profit = r.pnl >= 0;
    const pctPositive = r.gainPct >= 0;
    return (
      <div
        key={r.address}
        className={`flex items-center gap-2.5 px-1.5 py-[7px] rounded-[10px] ${isMe ? 'bg-[#00F59B]/10' : ''}`}
      >
        <span
          className={`w-[22px] text-center text-[13px] font-black shrink-0 ${
            i < 3 ? 'text-[#00F59B] [text-shadow:0_0_10px_rgba(0,245,155,.9)]' : 'text-[#F2F7F4]/35'
          }`}
        >
          {i + 1}
        </span>
        <Avatar profile={profile} address={r.address} size={28} />
        <span className="flex-1 text-[12px] font-semibold text-[#F2F7F4]/85 truncate">
          {profile?.display_name ? name : shortAddr(r.address)}
        </span>
        <TraderBadges keys={badges[r.address]} />
        <div className="text-right shrink-0">
          <div className={`text-[12px] font-extrabold ${pctPositive ? 'text-[#00F59B]' : 'text-[#ff4d6d]'}`}>
            {formatPct(r.gainPct)}
          </div>
          <div className={`text-[10px] opacity-75 ${profit ? 'text-[#00F59B]' : 'text-[#ff4d6d]'}`}>
            {profit ? '+' : ''}{r.pnl.toFixed(2)} XLM on {r.spent.toFixed(2)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#101816] border border-[#16211E] rounded-2xl overflow-hidden">
      <div className="px-3.5 pt-3.5 pb-2.5">
        <h3 className="font-black text-[13px] tracking-[.06em] uppercase">🏆 Top Earners</h3>
        <p className="text-[10px] text-[#F2F7F4]/40 mt-0.5 tracking-[.03em]">
          Ranked by return % on XLM actually spent
        </p>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5">
          {BADGE_ORDER.map((key) => (
            <span
              key={key}
              title={BADGES[key].hint}
              className="text-[10px] text-[#F2F7F4]/35 tracking-[.03em]"
            >
              {BADGES[key].glyph} {BADGES[key].label}
            </span>
          ))}
        </div>
      </div>
      <div className="px-2.5 pb-3">
        {loading ? (
          <SkeletonRows />
        ) : top.length === 0 ? (
          <p className="text-[12px] text-[#F2F7F4]/40 text-center py-2">
            No round-trip trades yet. Be the first!
          </p>
        ) : (
          <div className="space-y-0.5">
            {top.map((r, i) => renderRow(r, i, r.address === walletAddress))}
            {myRow && myRank >= 50 && (
              <>
                <div className="text-center text-[#F2F7F4]/20 text-[12px] py-0.5">• • •</div>
                {renderRow(myRow, myRank, true)}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}