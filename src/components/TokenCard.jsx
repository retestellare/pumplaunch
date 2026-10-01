import { Link, useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import TokenIcon from './TokenIcon';

export default function TokenCard({ token, rank }) {
  const change = token.change_24h;
  const hasChange = change != null && !isNaN(change);
  const positive = (change ?? 0) >= 0;
  const navigate = useNavigate();
  return (
    <Link
      to={`/token/${token.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition border-b border-white/5"
    >
      {rank != null && <span className="w-5 text-sm text-white/30 font-medium">{rank}</span>}
      <TokenIcon token={token} size={40} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">${token.symbol}</span>
          {token.is_graduated && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88] font-bold">GRAD</span>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate(`/token/${token.id}/holders`);
            }}
            className="ml-1 flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 hover:text-[#00ff88] transition"
          >
            <Users size={10} /> {token.holders ?? '—'}
          </button>
        </div>
        <div className="text-xs text-white/40 truncate">{token.name}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">
          {token.price != null ? `$${Number(token.price).toFixed(8)}` : '—'}
        </div>
        <div className={`text-xs font-medium ${!hasChange ? 'text-white/30' : positive ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
          {hasChange ? `${positive ? '+' : ''}${change.toFixed(2)}%` : '—'}
        </div>
      </div>
    </Link>
  );
}