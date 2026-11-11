import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { fetchTokenHolders, withShares, majorityRank } from '@/lib/holders';

const shortAddr = (addr) => `${addr.slice(0, 6)}…${addr.slice(-6)}`;

function fmtAmount(n) {
  if (n >= 1000) return Math.round(n).toLocaleString('en-US');
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function SummaryCell({ label, value }) {
  return (
    <div className="flex-1 rounded-xl bg-white/[.04] px-2 py-2 text-center">
      <div className="text-[9px] font-black uppercase tracking-[.1em] text-white/35">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-white/90">{value}</div>
    </div>
  );
}

function HolderRow({ row, top, inMajority }) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-xl bg-[#141518] px-3 py-2.5">
      {/* The bar is sized against the biggest holder, so the shape of the
          holdings is readable at a glance without exact numbers. */}
      <span
        className={`absolute inset-y-0 left-0 ${inMajority ? 'bg-[#00ff88]/[.07]' : 'bg-white/[.03]'}`}
        style={{ width: `${top > 0 ? Math.max(4, (row.balance / top) * 100) : 0}%` }}
      />
      <span className="relative w-5 shrink-0 text-xs font-bold text-white/30">{row.rank}</span>
      <div className="relative min-w-0 flex-1">
        <div className="truncate font-mono text-xs text-white/80">{shortAddr(row.address)}</div>
        <div className="text-[10px] text-white/35">
          {row.share.toFixed(row.share >= 10 ? 1 : 2)}% of held supply
        </div>
      </div>
      <div className="relative shrink-0 text-right">
        <div className="text-sm font-bold text-white/90">{fmtAmount(row.balance)}</div>
        <div className="text-[9px] uppercase tracking-[.08em] text-white/25">{row.rank === 1 ? 'top holder' : 'tokens'}</div>
      </div>
    </div>
  );
}

// Who owns the token. The wallets are read from the chain when the panel opens,
// biggest first, with the point where they pass half the held supply marked, so
// the controlling group is obvious.
export default function HoldersSheet({ token, open, onOpenChange }) {
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    if (!token?.asset_code || !token?.issuer) {
      setHolders([]);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setFailed(false);
    fetchTokenHolders(token.asset_code, token.issuer)
      .then((rows) => active && setHolders(rows))
      .catch(() => active && setFailed(true))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [open, token?.asset_code, token?.issuer]);

  const { total, rows } = withShares(holders);
  const cutoff = rows.length ? majorityRank(rows) : 0;
  const top = rows[0]?.balance || 0;
  const share = (n) => (rows[n - 1] ? rows[n - 1].cumulative.toFixed(1) : '—');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-0 rounded-t-2xl border-white/10 bg-[#0f1013] p-0 text-white"
      >
        <div className="border-b border-white/5 px-4 pb-3 pt-4">
          <SheetTitle className="text-base font-bold text-white">
            Holders {token?.symbol && <span className="text-white/40">· ${token.symbol}</span>}
          </SheetTitle>
          <p className="mt-0.5 text-[11px] text-white/40">
            {loading
              ? 'Reading holders from Stellar mainnet…'
              : failed
              ? 'Holders could not be read right now.'
              : `${rows.length} wallets hold ${token?.symbol || 'this token'}`}
          </p>
          {rows.length > 0 && (
            <div className="mt-3 flex gap-1.5">
              <SummaryCell label="Top 1" value={`${share(1)}%`} />
              <SummaryCell label="Top 5" value={`${share(5)}%`} />
              <SummaryCell label="Top 10" value={`${share(10)}%`} />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 size={22} className="animate-spin text-[#00ff88]" />
            </div>
          )}
          {!loading && failed && (
            <p className="py-12 text-center text-sm text-white/40">The holder list is unavailable right now.</p>
          )}
          {!loading && !failed && rows.length === 0 && (
            <p className="py-12 text-center text-sm text-white/40">No wallets hold this token yet.</p>
          )}
          {!loading &&
            !failed &&
            rows.map((row) => (
              <div key={row.address}>
                <HolderRow row={row} top={top} inMajority={row.rank <= cutoff} />
                {row.rank === cutoff && rows.length > 1 && (
                  <div className="flex items-center gap-2 px-1 pt-1.5 pb-0.5">
                    <span className="h-px flex-1 bg-[#00ff88]/30" />
                    <span className="text-[9px] font-black uppercase tracking-[.1em] text-[#00ff88]/70">
                      {cutoff === 1 ? 'This wallet' : `Top ${cutoff} wallets`} control {row.cumulative.toFixed(1)}%
                    </span>
                    <span className="h-px flex-1 bg-[#00ff88]/30" />
                  </div>
                )}
              </div>
            ))}
        </div>

        {rows.length > 0 && (
          <div className="border-t border-white/5 px-4 py-2.5 text-[10px] leading-relaxed text-white/30">
            {fmtAmount(total)} {token?.symbol || 'tokens'} across {rows.length} wallets, ranked by balance. Wallets
            above the green line together control more than half of the held supply.
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}