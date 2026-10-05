import { ChevronRight } from 'lucide-react';
import TokenIcon from '@/components/TokenIcon';

function short(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtSupply(n) {
  if (!n) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function AssetCandidate({ asset, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition border-b border-white/5 last:border-b-0"
    >
      <TokenIcon token={{ symbol: asset.code }} size={36} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">${asset.code}</div>
        <div className="text-[10px] text-white/30 font-mono truncate">{short(asset.issuer)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-xs text-white/60">{fmtSupply(asset.supply)}</div>
        <div className="text-[10px] text-white/30">supply</div>
      </div>
      <ChevronRight size={16} className="text-white/20 shrink-0" />
    </button>
  );
}