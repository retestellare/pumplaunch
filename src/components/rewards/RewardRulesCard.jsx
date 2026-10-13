import { REWARD_TYPES, rewardFor } from '@/lib/rewards';
import { REFERRAL_REQUIREMENT } from '@/lib/referralEligibility';
import { X_REQUIREMENT } from '@/lib/xAccount';

function fmtXlm(value) {
  const v = parseFloat(value) || 0;
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// The program in plain terms: what earns, how much, and when a claim can be made.
export default function RewardRulesCard({ rules }) {
  const active = rules.is_active !== false;
  return (
    <div className="bg-[#101816] border border-[#00F59B]/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-black tracking-[.08em] uppercase text-[#00F59B]">
          How Rewards Work
        </h3>
        <span
          className={`text-[10px] font-black tracking-[.08em] uppercase px-2 py-1 rounded-full border ${
            active
              ? 'text-[#00F59B] border-[#00F59B]/40 bg-[#00F59B]/10'
              : 'text-[#ffb020] border-[#ffb020]/40 bg-[#ffb020]/10'
          }`}
        >
          {active ? 'Live' : 'Paused'}
        </span>
      </div>

      <div className="space-y-2.5">
        {REWARD_TYPES.map((type) => (
          <div key={type.key} className="space-y-1">
            <div className="flex items-center gap-3">
              <span aria-hidden className="text-[16px] leading-none">
                {type.glyph}
              </span>
              <span className="flex-1 text-xs text-[#F2F7F4]/70">{type.label}</span>
              <span className="font-mono text-xs font-bold text-[#00F59B]">
                {fmtXlm(rewardFor(rules, type.key))} XLM
              </span>
            </div>
            {type.key === 'referral' && (
              <p className="pl-7 text-[10px] text-[#F2F7F4]/40">{REFERRAL_REQUIREMENT}</p>
            )}
          </div>
        ))}
      </div>

      <div className="border-t border-white/5 pt-3 space-y-1">
        <p className="text-[11px] text-[#F2F7F4]/60">
          Claims start at{' '}
          <span className="font-bold text-[#00F59B]">{fmtXlm(rules.min_claim_xlm)} XLM</span> — each
          action is credited once per wallet.
        </p>
        <p className="text-[11px] font-bold text-[#00F59B]/80 pt-1">{X_REQUIREMENT}</p>
        {rules.rules_note && <p className="text-[10px] text-[#F2F7F4]/40">{rules.rules_note}</p>}
      </div>
    </div>
  );
}