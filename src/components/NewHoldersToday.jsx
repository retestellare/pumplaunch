import { useState, useEffect } from 'react';
import { Image } from '@/components/ui/image';
import { fetchNewHolders } from '@/lib/leaderboard';
import { PANEL_IMAGE } from '@/lib/brandAssets';

function shortAddr(addr) {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function SkeletonRows() {
  return (
    <div className="space-y-1.5 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5 px-1 py-1.5">
          <div className="w-6 h-6 rounded-full bg-[#16211E]" />
          <div className="flex-1 h-2.5 rounded bg-[#16211E]" />
          <div className="w-16 h-2.5 rounded bg-[#16211E]" />
        </div>
      ))}
    </div>
  );
}

export default function NewHoldersToday({ tokens }) {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);

  const tokenKey = tokens.map((t) => t.id).join(',');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchNewHolders(tokens);
        if (active) setHolders(data);
      } catch { /* ignore */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [tokenKey]);

  return (
    <div className="bg-[#101816] border border-[#16211E] rounded-2xl overflow-hidden relative">
      <div className="relative px-3.5 pt-3.5 pb-2.5">
        <div className="absolute right-0 top-0 w-[45%] h-full opacity-35 [mask-image:linear-gradient(90deg,transparent,#000)] [-webkit-mask-image:linear-gradient(90deg,transparent,#000)]">
          <Image src={PANEL_IMAGE} alt="" fittingType="fill" className="w-full h-full" />
        </div>
        <div className="relative">
          <h3 className="font-black text-[13px] tracking-[.06em] uppercase">🆕 New Holders Today</h3>
          <p className="text-[10px] text-[#F2F7F4]/40 mt-0.5 tracking-[.03em]">
            Wallets that bought in the last 24h
          </p>
        </div>
      </div>
      <div className="px-2.5 pb-3">
        {loading ? (
          <SkeletonRows />
        ) : holders.length === 0 ? (
          <p className="text-[12px] text-[#F2F7F4]/40 text-center py-1.5">
            No new holders in the last 24h.
          </p>
        ) : (
          <div className="space-y-0.5">
            {holders.map((h, i) => (
              <div key={h.address + i} className="flex items-center gap-2.5 px-1 py-[7px] text-[12px]">
                <span className="w-6 h-6 rounded-full bg-[#16211E] flex items-center justify-center text-[10px] font-extrabold text-[#00F59B] shrink-0">
                  {h.address.slice(0, 1)}
                </span>
                <span className="font-mono text-[#F2F7F4]/75 text-[11px]">{shortAddr(h.address)}</span>
                <span className="text-[11px] text-[#F2F7F4]/40">bought</span>
                <span className="flex-1 text-right text-[11px] font-extrabold text-[#00F59B] truncate">
                  {h.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${h.tokenSymbol}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}