import { Check, Clock, Wallet } from 'lucide-react';
import { formatUnlockDate } from '@/lib/timelock';

// A time-locked launch travels as two approvals: the classic launch envelope,
// then the contract call that sets the unlock instant.
export default function TimelockApprovalCard({ percent = 50, unlockAt = 0, unit = 'XLM' }) {
  const jobs = [
    'Creates the issuing account and mints the supply',
    `Moves your ${unit} deposit into the vault and seeds the pool`,
    `Hands ${percent}% of the pool shares to the timelock contract`,
  ];

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-[#00ff88] text-black flex items-center justify-center">
          <Wallet size={13} />
        </span>
        <div>
          <h3 className="text-sm font-bold">Two approvals</h3>
          <p className="text-[10px] text-white/30">One for the launch, one for the contract</p>
        </div>
      </div>

      <div className="space-y-2">
        {jobs.map((job) => (
          <div key={job} className="flex items-start gap-2">
            <Check size={12} className="text-[#00ff88] mt-0.5 shrink-0" />
            <span className="text-xs text-white/70">{job}</span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-white/[.03] px-3 py-2">
        <Clock size={12} className="text-white/30 mt-0.5 shrink-0" />
        <p className="text-[10px] leading-relaxed text-white/40">
          The shares cannot move before {formatUnlockDate(unlockAt)} — the contract refuses every release until
          then, so no key of yours can pull the liquidity early.
        </p>
      </div>
    </div>
  );
}