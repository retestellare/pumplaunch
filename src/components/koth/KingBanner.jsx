import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown } from 'lucide-react';
import TokenIcon from '@/components/TokenIcon';
import { reignLabel } from '@/lib/koth';

// The throne, at the top of Home: who holds it, the stake behind it, and how long
// it has held. The reign label re-reads the clock while the page sits open.
export default function KingBanner({ king, onChallenge }) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (!king?.reign_start) return;
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [king?.reign_start]);

  const bid = Number(king?.bid_xlm) || 0;

  return (
    <section className="mx-3.5 mt-3 rounded-[14px] border border-[#FFD166]/35 bg-[linear-gradient(135deg,rgba(255,209,102,.16),rgba(16,24,22,.92))] px-3 py-3 animate-[sp-up_.6s_.12s_ease-out_both]">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.12em] text-[#FFD166] [text-shadow:0_0_10px_rgba(255,209,102,.5)]">
          <Crown size={13} /> King of the Hill
        </span>
        {king?.reign_start && (
          <span className="text-[10px] font-bold uppercase tracking-[.06em] text-[#F2F7F4]/45">
            Reign {reignLabel(king.reign_start)}
          </span>
        )}
      </div>

      {king ? (
        <div className="mt-2.5 flex items-center gap-2.5">
          <TokenIcon
            token={{ symbol: king.token_symbol, image_url: king.token_image }}
            size={42}
            shape="square"
          />
          <Link to={`/token/${king.token_id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-display text-[15px] text-[#FFD166]">
                ${king.token_symbol}
              </span>
              <span className="text-[13px] leading-none">👑</span>
            </div>
            <div className="truncate text-[10px] uppercase tracking-[.05em] text-[#F2F7F4]/45">
              {king.token_name || 'Reigning token'}
            </div>
          </Link>
          <div className="shrink-0 text-right">
            <div className="font-extrabold tabular-nums text-[14px] text-[#FFD166]">
              {bid.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM
            </div>
            <div className="text-[9px] uppercase tracking-[.08em] text-[#F2F7F4]/35">
              Highest stake
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-[#F2F7F4]/55">
          The throne is empty. Stake XLM on a token you back and crown the first King.
        </p>
      )}

      <button
        onClick={onChallenge}
        className="mt-2.5 h-[38px] w-full rounded-[10px] bg-[#FFD166] font-black text-[11px] uppercase tracking-[.08em] text-[#241a02] transition duration-200 hover:shadow-[0_0_16px_rgba(255,209,102,.55)] active:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFD166]"
      >
        {king ? 'Challenge the King' : 'Claim the Throne'}
      </button>
    </section>
  );
}