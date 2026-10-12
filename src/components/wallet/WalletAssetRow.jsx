import { Link } from 'react-router-dom';
import TokenIcon from '@/components/TokenIcon';
import { formatAmount } from '@/lib/candles';
import { positionPnl } from '@/lib/positions';

function fmtXlm(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K XLM`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`;
}

// One asset in the wallet: what the holding is worth right now, and how it has
// done since it was bought — the XLM still in it, plus everything already taken
// back out of it, against everything that went in. Tapping it opens the asset's
// own chart and trade screen.
export default function WalletAssetRow({ asset, cost }) {
  const symbol = asset.symbol || asset.code;
  const price = asset.price > 0 ? asset.price : null;
  const value = price != null ? price * (asset.balance || 0) : null;
  const position = positionPnl({ value, cost });
  const change = asset.change24h;
  const pressure = asset.pressure;
  const depth = asset.depth;
  const barPct = pressure ? pressure.buyPct : depth?.bidPct;
  const barLabel = pressure
    ? `${pressure.buyPct.toFixed(0)}% buys 24h`
    : depth
    ? `book ${depth.bidPct.toFixed(0)}% bids`
    : '';

  return (
    <Link
      to={`/asset/${asset.code}/${asset.issuer}`}
      className="block px-3 py-3 bg-[#141518] rounded-xl mb-2 active:bg-[#1a1c20] transition"
    >
      <div className="flex items-center gap-3">
        <TokenIcon token={{ ...asset, symbol }} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-semibold text-sm shrink-0">${symbol}</span>
            {asset.domain && (
              <span className="text-[10px] text-white/30 truncate">{asset.domain}</span>
            )}
          </div>
          <div className="text-xs text-white/40 truncate">
            {formatAmount(asset.balance)} {symbol}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold">
            {value != null ? `≈ ${fmtXlm(value)}` : 'No market'}
          </div>
          {position ? (
            <div
              className={`text-xs font-medium ${
                position.pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3b5c]'
              }`}
            >
              {position.pnl >= 0 ? '+' : '−'}
              {fmtXlm(Math.abs(position.pnl))} · {position.pct >= 0 ? '↑' : '↓'}
              {Math.abs(position.pct).toFixed(1)}%
            </div>
          ) : (
            change != null && (
              <div className="text-xs text-white/40">
                {change >= 0 ? '+' : ''}
                {change.toFixed(1)}% today
              </div>
            )
          )}
        </div>
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