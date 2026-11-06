import { Check, Lock, Wallet } from 'lucide-react';

// A locked launch travels as one signed transaction, so the review states plainly
// that a single wallet approval covers creation, the deposit and the lock.
export default function SingleApprovalCard({ unit = 'XLM' }) {
  const jobs = [
    'Creates the issuing account and mints the supply',
    `Moves your ${unit} deposit into a fresh vault account`,
    'Seeds the pool and locks its shares away forever',
  ];

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-[#00ff88] text-black flex items-center justify-center">
          <Wallet size={13} />
        </span>
        <div>
          <h3 className="text-sm font-bold">One approval, the whole launch</h3>
          <p className="text-[10px] text-white/30">A single signature in your wallet</p>
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
        <Lock size={12} className="text-white/30 mt-0.5 shrink-0" />
        <p className="text-[10px] leading-relaxed text-white/40">
          Everything above is authorised at once, so PumpLaunch and your wallet stop trading prompts. If your wallet
          cannot sign the combined request, the launch finishes with the remaining approvals one at a time — nothing
          is lost either way.
        </p>
      </div>
    </div>
  );
}