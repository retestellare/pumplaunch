import { REWARD_TYPES } from '@/lib/rewards';

function fmtXlm(value) {
  return (parseFloat(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// What the wallet has earned so far, split by the action that earned it.
export default function RewardProgress({ progress, rules }) {
  const min = parseFloat(rules.min_claim_xlm) || 0;
  const short = Math.max(0, min - (progress.claimable || 0));

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold">Your progress</h3>
          <p className="text-[10px] text-[#F2F7F4]/40 mt-0.5">Credited in XLM, reviewed by hand</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold text-[#00F59B]">{fmtXlm(progress.total)} XLM</p>
          <p className="text-[10px] text-[#F2F7F4]/35">earned in total</p>
        </div>
      </div>

      <div className="space-y-2">
        {REWARD_TYPES.map((type) => {
          const row = progress.rows[type.key] || { count: 0, xlm: 0 };
          return (
            <div key={type.key} className="flex items-center gap-3 bg-black/25 rounded-xl px-3 py-2.5">
              <span aria-hidden className="text-[16px] leading-none">
                {type.glyph}
              </span>
              <span className="flex-1 text-xs text-[#F2F7F4]/70">{type.label}</span>
              <span className="text-[10px] font-mono text-[#F2F7F4]/40">{row.count}×</span>
              <span className="font-mono text-xs font-bold text-[#F2F7F4]">{fmtXlm(row.xlm)} XLM</span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/5 pt-3 flex items-center justify-between text-xs">
        <span className="text-[#F2F7F4]/50">Ready to claim</span>
        <span className="font-mono font-bold text-[#00F59B]">{fmtXlm(progress.claimable)} XLM</span>
      </div>
      {short > 0 && (
        <p className="text-[10px] text-[#F2F7F4]/35">
          {fmtXlm(short)} XLM more to reach the {fmtXlm(min)} XLM claim threshold.
        </p>
      )}
    </div>
  );
}