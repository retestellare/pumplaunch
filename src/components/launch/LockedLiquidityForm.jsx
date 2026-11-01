import { Lock } from 'lucide-react';
import { LOCKED_MIN_DEPOSIT } from '@/lib/lockedLiquidity';

const QUOTE_CHOICES = [
  { key: 'xlm', label: 'XLM' },
  { key: 'usdc', label: 'USDC' },
];

function fmt(n) {
  if (!n) return '0';
  return Math.floor(n).toLocaleString();
}

// Deposit and quote choices for a locked launch, with the split the contract
// enforces shown before anything is signed.
export default function LockedLiquidityForm({
  quote,
  onQuote,
  deposit,
  onDeposit,
  plan,
  symbol,
  rateReady,
  usdcTrustline,
  disabled,
}) {
  const unit = quote === 'usdc' ? 'USDC' : 'XLM';
  const sym = symbol || 'tokens';

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Locked Liquidity Asset</label>
        <div className="flex gap-1 p-1 rounded-xl bg-black/30">
          {QUOTE_CHOICES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onQuote(c.key)}
              disabled={disabled}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition duration-200 disabled:opacity-40 ${
                quote === c.key ? 'bg-[#00ff88] text-black' : 'text-white/50 hover:text-white/80'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Liquidity to Lock ({unit})</label>
        <input
          type="number"
          value={deposit}
          onChange={(e) => onDeposit(e.target.value)}
          placeholder="e.g. 50"
          disabled={disabled}
          className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 disabled:opacity-40"
        />
        <p className="text-[10px] text-white/30 mt-1">
          {LOCKED_MIN_DEPOSIT > 0
            ? `Minimum ${LOCKED_MIN_DEPOSIT} ${unit}.`
            : 'No minimum while the model is in testing.'}{' '}
          This amount leaves your wallet for good.
        </p>
        {quote === 'usdc' && !usdcTrustline && deposit ? (
          <p className="text-[10px] text-[#ffb020] mt-1">
            A USDC trustline is added in the same launch.
          </p>
        ) : null}
        {quote === 'usdc' && !rateReady ? (
          <p className="text-[10px] text-white/30 mt-1">Reading the XLM/USDC rate…</p>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#00ff88]/20 bg-[#00ff88]/[.04] p-3 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.1em] text-[#00ff88]">
          <Lock size={11} /> Locked launch preview
        </div>
        <Row label="Fixed ratio" value={plan.tokensPerQuote ? `1 ${unit} = ${fmt(plan.tokensPerQuote)} ${sym}` : '—'} />
        <Row label="You receive" value={`${fmt(plan.creatorTokens)} ${sym}`} tone="text-[#00ff88]" />
        <Row label="Locked in the pool" value={`${fmt(plan.vaultTokens)} ${sym}`} />
        <Row label="Total supply" value={fmt(plan.supply)} />
        <Row
          label="Launch price"
          value={plan.tokensPerQuote ? `${(1 / plan.tokensPerQuote).toFixed(8)} ${unit}` : '—'}
        />
      </div>

      <p className="text-[10px] leading-relaxed text-white/35">
        The pool shares are sent to a balance that can never be claimed, so nobody — not even you — can
        withdraw this liquidity. Your own tokens can only be sold back into it, and buyers get the other
        half as they purchase.
      </p>
    </div>
  );
}

function Row({ label, value, tone = 'text-white/90' }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-white/40">{label}</span>
      <span className={`font-mono ${tone}`}>{value}</span>
    </div>
  );
}