import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { submitClaim } from '@/lib/rewards';

function fmtXlm(value) {
  return (parseFloat(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// Submitting freezes the credited rewards into a claim an admin reviews.
export default function ClaimPanel({ wallet, progress, rules, pending, onSubmitted }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const min = parseFloat(rules.min_claim_xlm) || 0;
  const claimable = progress.claimable || 0;
  const enough = claimable >= min && claimable > 0;

  const submit = async () => {
    setBusy(true);
    try {
      const claim = await submitClaim(wallet);
      toast({
        title: `Claim of ${fmtXlm(claim.amount_xlm)} XLM submitted`,
        description: 'It is waiting for review. Payouts are sent by hand once approved.',
      });
      onSubmitted?.();
    } catch (e) {
      toast({ title: 'Could not submit the claim', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (!rules.is_active) {
    return (
      <div className="bg-[#141518] rounded-2xl p-4">
        <p className="text-sm text-[#F2F7F4]/60">
          Rewards are paused right now — activity is not credited until they are live again.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold">Claim your XLM</h3>
        <p className="text-[10px] text-[#F2F7F4]/40 mt-0.5">
          Claims are reviewed by another member of the team, then paid to your wallet by hand.
        </p>
      </div>

      {pending ? (
        <div className="bg-[#ffb020]/10 border border-[#ffb020]/30 rounded-xl p-3">
          <p className="text-xs font-bold text-[#ffb020]">
            {fmtXlm(pending.amount_xlm)} XLM is waiting for review
          </p>
          <p className="text-[10px] text-[#F2F7F4]/50 mt-0.5">
            Submitted {new Date(pending.created_date).toLocaleDateString()}. You can claim again once
            this one is settled.
          </p>
        </div>
      ) : (
        <button
          onClick={submit}
          disabled={busy || !enough}
          className="w-full py-3.5 rounded-xl bg-[#00F59B] text-[#04100B] font-bold text-sm disabled:opacity-50"
        >
          {busy
            ? 'Submitting…'
            : enough
            ? `Claim ${fmtXlm(claimable)} XLM`
            : claimable > 0
            ? `${fmtXlm(min - claimable)} XLM to the ${fmtXlm(min)} XLM minimum`
            : 'Nothing to claim yet'}
        </button>
      )}
    </div>
  );
}