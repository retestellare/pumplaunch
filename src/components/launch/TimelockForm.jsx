import { CalendarClock, Clock, Lock, ShieldAlert } from 'lucide-react';
import { LOCK_PERCENT_CHOICES, LOCK_PRESETS, formatUnlockDate } from '@/lib/timelock';

function fmt(n) {
  if (!n) return '0';
  return Math.floor(n).toLocaleString();
}

const MODE_CHOICES = [
  { key: 'permanent', label: 'Permanent', hint: 'Gone forever' },
  { key: 'timelock', label: 'Time lock', hint: 'Unlocks on a date' },
];

// How the pool shares are held: burned forever on a keyless vault, or handed to
// the Soroban timelock contract with an unlock instant. The unlock date comes
// from the last closed ledger and is shown before anything is signed.
export default function TimelockForm({
  mode,
  onMode,
  percent,
  onPercent,
  days,
  onDays,
  unlockAt,
  shares,
  symbol,
  configured,
  disabled,
}) {
  const sym = symbol || 'tokens';
  const timeLocked = mode === 'timelock';

  return (
    <div className="space-y-3 pt-1">
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Lock Type</label>
        <div className="flex gap-1 p-1 rounded-xl bg-black/30">
          {MODE_CHOICES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onMode(c.key)}
              disabled={disabled}
              className={`flex-1 py-2 rounded-lg transition duration-200 disabled:opacity-40 ${
                mode === c.key ? 'bg-[#00ff88] text-black' : 'text-white/50 hover:text-white/80'
              }`}
            >
              <span className="block text-xs font-bold">{c.label}</span>
              <span className={`block text-[9px] mt-0.5 ${mode === c.key ? 'text-black/60' : 'text-white/30'}`}>
                {c.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {timeLocked && (
        <>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Pool Shares in the Lock</label>
            <div className="flex gap-1 p-1 rounded-xl bg-black/30">
              {LOCK_PERCENT_CHOICES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => onPercent(c.value)}
                  disabled={disabled}
                  className={`flex-1 py-2 rounded-lg transition duration-200 disabled:opacity-40 ${
                    Number(percent) === c.value ? 'bg-[#00ff88] text-black' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <span className="block text-xs font-bold">{c.label}</span>
                  <span
                    className={`block text-[9px] mt-0.5 ${Number(percent) === c.value ? 'text-black/60' : 'text-white/30'}`}
                  >
                    {c.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Lock Duration</label>
            <div className="grid grid-cols-2 gap-1.5">
              {LOCK_PRESETS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => onDays(p.days)}
                  disabled={disabled}
                  className={`py-2 rounded-lg text-xs font-bold transition duration-200 disabled:opacity-40 ${
                    Number(days) === p.days ? 'bg-[#00ff88] text-black' : 'bg-black/30 text-white/50 hover:text-white/80'
                  }`}
                >
                  {p.label}
                  <span
                    className={`block text-[9px] font-normal ${Number(days) === p.days ? 'text-black/60' : 'text-white/30'}`}
                  >
                    {p.hint}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#00ff88]/20 bg-[#00ff88]/[.04] p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#00ff88]">
              <CalendarClock size={11} /> Unlocks
            </div>
            <p className="font-mono text-[13px] text-white/90">{formatUnlockDate(unlockAt)}</p>
            <p className="text-[10px] leading-relaxed text-white/40">
              Counted from the last closed Stellar ledger. Before that instant the contract refuses every release —
              not even you can withdraw the shares.
            </p>
            <div className="flex items-center justify-between gap-3 text-[11px] pt-1">
              <span className="text-white/40">Shares in the lock</span>
              <span className="font-mono text-white/90">
                {shares > 0 ? `${fmt(shares)} of ${fmt(shares / (Number(percent) === 100 ? 1 : 0.5))}` : 'Read after the deposit'}
              </span>
            </div>
          </div>

          {configured ? (
            <p className="text-[10px] leading-relaxed text-white/35">
              The launch takes two approvals: one for the token and the pool, one for the contract call that hands
              the shares to the timelock. The other {100 - Number(percent)}% of the shares stay with you and can be
              sold back into the pool at any time.
            </p>
          ) : (
            <div className="rounded-xl border border-[#ffb020]/30 bg-[#ffb020]/[.06] px-3 py-2">
              <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#ffb020]">
                <ShieldAlert size={11} /> Timelock contract not connected
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">
                Paste the address of your deployed contract to enable time-locked launches. Until then a time lock
                stops the launch before anything is signed.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl bg-white/[.03] px-3 py-2">
            <Lock size={12} className="text-white/30 mt-0.5 shrink-0" />
            <p className="text-[10px] leading-relaxed text-white/40">
              {percent === 100
                ? `All the pool shares sit in the timelock, so nobody can withdraw the ${sym} liquidity before the unlock date.`
                : `Half the pool shares sit in the timelock for the full term — the half that can never be pulled early.`}
            </p>
          </div>
        </>
      )}

      {!timeLocked && (
        <div className="flex items-start gap-2 rounded-xl bg-white/[.03] px-3 py-2">
          <Clock size={12} className="text-white/30 mt-0.5 shrink-0" />
          <p className="text-[10px] leading-relaxed text-white/40">
            The pool shares go to a vault that loses its only signer, so the liquidity is unwithdrawable forever.
            Pick Time lock instead if you want the deposit back on a known date.
          </p>
        </div>
      )}
    </div>
  );
}