import { Link, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import TokenIcon from './TokenIcon';
import PoolBadge from './PoolBadge';
import { launchTag } from '@/lib/launchTag';

// Rows stagger in; the first four also carry the price flash from the terminal design.
const rowDelay = (i) => (i < 4 ? `${0.3 + i * 0.08}s` : '0s');
const priceDelay = (i) => (i > 0 && i < 4 ? `${0.3 + i * 0.1}s` : '0s');

export default function TokenCard({ token, rank, index = 0 }) {
  const change = token.liquidity_change_24h;
  const hasChange = change != null && !isNaN(change);
  const positive = (change ?? 0) >= 0;
  const navigate = useNavigate();

  return (
    <Link
      to={`/token/${token.id}`}
      style={{ animationDelay: rowDelay(index) }}
      className="flex items-center gap-2.5 px-3.5 py-[11px] border-b border-[#16211E] animate-[sp-up_.5s_ease-out_both] transition-colors duration-200 hover:bg-[#0f1815] active:bg-[#14211d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
    >
      {rank != null && (
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-[#00F59B] bg-[#0c1512] border border-[#00F59B]/55 shadow-[0_0_10px_rgba(0,245,155,.55),inset_0_0_6px_rgba(0,245,155,.25)] shrink-0">
          {rank}
        </span>
      )}
      <TokenIcon token={token} size={40} shape="square" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-extrabold text-[13px] tracking-[-.01em]">${token.symbol}</span>
          <PoolBadge token={token} />
          {token.is_graduated && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-[4px] bg-[#00F59B]/[0.14] text-[#00F59B] font-black tracking-[.05em] uppercase">
              GRAD
            </span>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/token/${token.id}/holders`);
            }}
            className="ml-0.5 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#16211E] text-[#F2F7F4]/60 font-bold transition duration-200 hover:text-[#00F59B] hover:shadow-[0_0_8px_rgba(0,245,155,.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
          >
            <Users size={10} /> {token.holders ?? '—'}
          </button>
        </div>
        <div className="text-[11px] text-[#F2F7F4]/45 mt-0.5 uppercase tracking-[.04em] truncate">
          {token.name}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div
          style={{ animationDelay: priceDelay(index) }}
          className="text-[12px] font-bold tabular-nums rounded-[4px] px-0.5 animate-[sp-flash_1.4s_ease-out_both]"
        >
          {token.price != null ? `$${Number(token.price).toFixed(8)}` : '—'}
        </div>
        <div
          className={`text-[11px] font-extrabold mt-0.5 ${
            !hasChange ? 'text-[#F2F7F4]/30' : positive ? 'text-[#00F59B]' : 'text-[#ff4d6d]'
          }`}
        >
          {hasChange ? `${positive ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </div>
        <div className="text-[9px] font-black uppercase tracking-[.06em] text-[#F2F7F4]/35 mt-1 whitespace-nowrap">
          {launchTag(token)}
        </div>
      </div>
    </Link>
  );
}