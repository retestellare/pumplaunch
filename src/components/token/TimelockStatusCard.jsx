import { useEffect, useState } from 'react';
import { Clock, ExternalLink, Lock, Unlock } from 'lucide-react';
import { formatRemaining, formatUnlockDate } from '@/lib/timelock';

function fmt(n) {
  if (n == null || isNaN(n)) return '—';
  return Math.floor(Number(n)).toLocaleString();
}

// The lock as the dApp reports it: locked while the contract's unlock instant is
// still ahead, expired after it. The countdown is the contract's deadline, not a
// promise this app keeps.
export default function TimelockStatusCard({ token }) {
  const unlockAt = Number(token?.timelock_unlock_at) || 0;
  const percent = Number(token?.timelock_percent) || 0;
  const shares = Number(token?.timelock_shares) || 0;
  const contract = token?.timelock_contract || '';
  const txHash = token?.timelock_tx || '';

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!unlockAt) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [unlockAt]);

  if (!unlockAt) return null;

  const unlockMs = unlockAt * 1000;
  const remaining = unlockMs - now;
  const locked = remaining > 0;

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span
          className={`w-7 h-7 rounded-[9px] flex items-center justify-center shrink-0 border ${
            locked
              ? 'bg-[#00ff88]/[.12] border-[#00ff88]/30 text-[#00ff88]'
              : 'bg-[#ffb020]/[.12] border-[#ffb020]/30 text-[#ffb020]'
          }`}
        >
          {locked ? <Lock size={14} /> : <Unlock size={14} />}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-sm text-white/90">Timelocked Liquidity</h3>
          <p className="text-[10px] text-white/35">
            {locked
              ? 'Held by the timelock contract until the date below.'
              : 'The term is over — the contract now allows the release.'}
          </p>
        </div>
        <span
          className={`shrink-0 text-[9px] font-black uppercase tracking-[.12em] px-2 py-1 rounded-full border ${
            locked
              ? 'text-[#00ff88] border-[#00ff88]/40 bg-[#00ff88]/[.08]'
              : 'text-[#ffb020] border-[#ffb020]/40 bg-[#ffb020]/[.08]'
          }`}
        >
          {locked ? 'Locked' : 'Unlocked'}
        </span>
      </div>

      <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.12em] text-white/35">
          <Clock size={10} /> {locked ? 'Unlocks in' : 'Unlocked on'}
        </div>
        <p className={`font-mono text-[15px] mt-0.5 ${locked ? 'text-[#00ff88]' : 'text-white/70'}`}>
          {locked ? formatRemaining(remaining) : formatUnlockDate(unlockAt)}
        </p>
        <p className="text-[10px] text-white/35 mt-0.5">{formatUnlockDate(unlockAt)}</p>
      </div>

      <div className="flex items-start justify-between gap-3 text-sm">
        <span className="text-white/40">Shares in the lock</span>
        <span className="text-right">
          <span className="block font-medium text-white/90 font-mono">{shares > 0 ? fmt(shares) : '—'}</span>
          {percent > 0 && <span className="block text-[10px] text-white/30 mt-0.5">{percent}% of the pool shares</span>}
        </span>
      </div>

      <div className="border-t border-white/5 pt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {txHash && (
          <a
            href={`https://stellar.expert/explorer/public/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#00ff88] transition duration-200 hover:underline"
          >
            Lock transaction <ExternalLink size={11} />
          </a>
        )}
        {contract && (
          <a
            href={`https://stellar.expert/explorer/public/contract/${contract}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/45 transition duration-200 hover:text-[#00ff88]"
          >
            Timelock contract <ExternalLink size={11} />
          </a>
        )}
      </div>
    </div>
  );
}