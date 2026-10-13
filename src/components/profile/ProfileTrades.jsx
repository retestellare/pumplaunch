import { Link } from 'react-router-dom';
import { timeAgo } from '@/lib/timeAgo';

function fmt(value, digits = 2) {
  return (parseFloat(value) || 0).toLocaleString(undefined, { maximumFractionDigits: digits });
}

// The wallet's buys and sells, newest first.
export default function ProfileTrades({ trades }) {
  if (trades.length === 0) {
    return <p className="text-sm text-white/30 px-1 py-6 text-center">No trades yet.</p>;
  }

  return (
    <div className="bg-[#141518] rounded-2xl divide-y divide-white/5">
      {trades.map((trade) => {
        const buy = trade.type === 'buy';
        const row = (
          <div className="flex items-center gap-3 px-3.5 py-3">
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold ${buy ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
                {buy ? 'Buy' : 'Sell'} ${trade.token_symbol || '—'}
              </p>
              <p className="text-[10px] text-white/35 mt-0.5 truncate">
                {fmt(trade.tokens)} tokens · {timeAgo(trade.created_date)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono text-xs font-bold">{fmt(trade.amount_xlm)} XLM</div>
              <div className="text-[10px] text-white/30 font-mono">
                @ ${fmt(trade.price, 8)}
              </div>
            </div>
          </div>
        );
        return trade.token_id ? (
          <Link key={trade.id} to={`/token/${trade.token_id}`} className="block active:bg-white/5">
            {row}
          </Link>
        ) : (
          <div key={trade.id}>{row}</div>
        );
      })}
    </div>
  );
}