import { Link } from 'react-router-dom';
import TokenIcon from '@/components/TokenIcon';
import { formatPrice } from '@/lib/candles';
import { COLLECTION, assetCode, assetImage, assetPath } from '@/lib/registry';

function fmtXlm(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K XLM`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`;
}

// One asset the connected wallet launched, with what the registry publishes for
// it and the liquidity sitting behind it.
export default function ManagedAssetRow({ kind, record, data }) {
  const code = assetCode(record);
  const pressure = data?.pressure;
  const depth = data?.depth;
  const barPct = pressure ? pressure.buyPct : depth?.bidPct;
  const barLabel = pressure
    ? `${pressure.buyPct.toFixed(0)}% buys 24h`
    : depth
    ? `book ${depth.bidPct.toFixed(0)}% bids`
    : '';
  const change = data?.change24h;

  return (
    <Link
      to={assetPath(kind, record.id)}
      className="block px-3 py-3 bg-[#141518] rounded-xl mb-2 active:bg-[#1a1c20] transition"
    >
      <div className="flex items-center gap-3">
        <TokenIcon token={{ symbol: code, image_url: assetImage(record, kind) }} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-semibold text-sm shrink-0">${code || '—'}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 font-bold shrink-0">
              {kind === COLLECTION ? 'NFT' : 'TOKEN'}
            </span>
          </div>
          <div className="text-xs text-white/40 truncate">{record.name || '—'}</div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold">
            {data?.price > 0 ? `${formatPrice(data.price)} XLM` : 'No market'}
          </div>
          {change != null && (
            <div
              className={`text-xs font-medium ${
                change >= 0 ? 'text-[#00ff88]' : 'text-[#ff3b5c]'
              }`}
            >
              {change >= 0 ? '+' : ''}
              {change.toFixed(1)}% today
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-white/40">
        <span>Pooled {data?.poolXlm ? fmtXlm(data.poolXlm) : '—'}</span>
        <span>24h vol {data?.volume24h ? fmtXlm(data.volume24h) : '—'}</span>
        <span>{data?.holders ? `${data.holders} holders` : '—'}</span>
      </div>

      {barPct != null && (
        <div className="flex items-center gap-2 mt-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden flex bg-white/5">
            <div className="h-full bg-[#00ff88]" style={{ width: `${barPct}%` }} />
            <div className="h-full flex-1 bg-[#ff3b5c]" />
          </div>
          <span className="text-[10px] text-white/40 shrink-0">{barLabel}</span>
        </div>
      )}
    </Link>
  );
}