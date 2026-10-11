import OptionGroup from '@/components/launch/OptionGroup';
import { quoteOf } from '@/lib/pools';

// Which market(s) an Auto-Pool launch seeds. Split puts half the initial
// liquidity in each pool, so one launch ends up with two markets.
const MARKETS = [
  { value: 'xlm', label: 'XLM Pool', desc: 'All initial liquidity seeds the XLM pool.' },
  { value: 'usdc', label: 'USDC Pool', desc: 'All initial liquidity seeds the USDC pool.' },
  {
    value: 'split',
    label: 'Split XLM + USDC',
    desc: 'Half the liquidity seeds an XLM pool, half a USDC pool — two markets from one launch.',
  },
];

export function fmtPoolAmount(value) {
  const n = parseFloat(value) || 0;
  return n > 0 ? n.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '0';
}

export default function PoolPairSelector({
  poolType,
  onSelect,
  allocation,
  symbol,
  needsUsdc,
  rateReady,
  usdcTrustline,
  disabled,
}) {
  return (
    <div className="space-y-3">
      <OptionGroup
        label="Pool Pair"
        options={MARKETS}
        isSelected={(opt) => poolType === opt.value}
        onSelect={(opt) => onSelect(opt.value)}
        disabled={disabled}
      />

      <div className="bg-black/30 rounded-xl p-3 space-y-1.5">
        <p className="text-[10px] text-white/40">Initial liquidity allocation</p>
        {allocation.map((a) => (
          <div key={a.quote} className="flex items-center justify-between text-xs">
            <span className="text-white/40">{quoteOf(a.quote).label} pool</span>
            <span className="font-medium">
              {a.amount > 0
                ? `${fmtPoolAmount(a.amount)} ${quoteOf(a.quote).label} + ${Math.floor(a.tokens).toLocaleString()} ${symbol}`
                : '—'}
            </span>
          </div>
        ))}
        {!rateReady && <p className="text-[10px] text-white/40">Reading the XLM/USDC rate…</p>}
        {needsUsdc && (
          <p className="text-[10px] text-white/30 pt-0.5">
            The USDC pool is funded from your wallet's USDC
            {usdcTrustline ? '' : ' — a USDC trustline is added during the launch (0.5 XLM reserve)'}.
          </p>
        )}
      </div>
    </div>
  );
}