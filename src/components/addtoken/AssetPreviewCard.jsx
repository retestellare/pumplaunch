import { CheckCircle2, Plus } from 'lucide-react';
import TokenIcon from '@/components/TokenIcon';
import PoolBadge from '@/components/PoolBadge';

function fmt(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: d });
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-white/40">{label}</span>
      <span className={`font-medium ${tone || ''}`}>{value}</span>
    </div>
  );
}

export default function AssetPreviewCard({ asset, listed, busy, onAdd, onBack }) {
  const change = asset.change24h;
  const positive = (change ?? 0) >= 0;
  const hasChange = change != null && !isNaN(change);

  return (
    <div className="space-y-3">
      <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <TokenIcon token={{ symbol: asset.code, image_url: asset.logo }} size={48} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold truncate">${asset.code}</span>
              <PoolBadge token={{ pools: asset.pools }} />
            </div>
            <p className="text-xs text-white/40 truncate">{asset.name}</p>
            {asset.homeDomain && <p className="text-[10px] text-white/30 truncate">{asset.homeDomain}</p>}
          </div>
        </div>

        <p className="text-[10px] text-white/30 font-mono break-all">{asset.issuer}</p>

        <div className="border-t border-white/5 pt-3 space-y-2">
          <Row
            label="Price"
            value={asset.price != null ? `${asset.price.toFixed(8)} XLM` : 'No market yet'}
          />
          <Row
            label="24h Change"
            value={hasChange ? `${positive ? '+' : ''}${change.toFixed(2)}%` : '—'}
            tone={hasChange ? (positive ? 'text-[#00ff88]' : 'text-[#ff3b5c]') : 'text-white/30'}
          />
          <Row label="Holders" value={fmt(asset.holders, 0)} />
          <Row label="Total Supply" value={fmt(asset.supply, 0)} />
        </div>
      </div>

      {listed && (
        <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-[#00ff88] shrink-0" />
          <p className="text-xs text-white/70">This token is already listed in the app.</p>
        </div>
      )}

      <button
        onClick={onAdd}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
      >
        {listed ? <CheckCircle2 size={16} /> : <Plus size={16} />}
        {busy ? 'Adding…' : listed ? 'View in App' : 'Add to App'}
      </button>

      {onBack && (
        <button onClick={onBack} className="w-full py-2 text-xs text-white/40 hover:text-white/70 transition">
          Not the one? Search again
        </button>
      )}
    </div>
  );
}