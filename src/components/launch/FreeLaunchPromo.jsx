import { Gift } from 'lucide-react';
import { FREE_LAUNCH } from '@/lib/freeLaunch';

export default function FreeLaunchPromo({ status, active, onStart, onStop }) {
  if (active) {
    return (
      <div className="bg-[#00ff88]/5 border border-[#00ff88]/40 rounded-2xl p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-[#00ff88] flex items-center gap-2">
            <Gift size={16} /> Free launch active
          </p>
          <button onClick={onStop} className="text-[11px] text-white/40 underline">
            Turn off
          </button>
        </div>
        <p className="text-xs text-white/70">
          {FREE_LAUNCH.liquidity} XLM of initial liquidity into the XLM pool in 100% Auto-Pool mode. We send your
          wallet the XLM for the liquidity, the reserves and the network fees.
        </p>
      </div>
    );
  }

  if (!status?.eligible) return null;

  return (
    <div className="bg-[#00ff88]/5 border border-[#00ff88]/30 rounded-2xl p-4 space-y-3">
      <div>
        <p className="text-sm font-bold text-[#00ff88] flex items-center gap-2">
          <Gift size={16} /> Your first launch is free
        </p>
        <p className="text-xs text-white/70 mt-1">
          New creators launch at no cost: {FREE_LAUNCH.liquidity} XLM of initial liquidity into the XLM pool in 100%
          Auto-Pool mode, with the XLM for the liquidity, the reserves and the fees sent to your wallet.
        </p>
      </div>
      <button onClick={onStart} className="w-full py-3 rounded-xl bg-[#00ff88] text-black font-bold text-sm">
        Use my free launch
      </button>
    </div>
  );
}