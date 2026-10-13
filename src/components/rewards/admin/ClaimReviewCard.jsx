import { useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { markClaimPaid, reviewClaim } from '@/lib/rewards';
import { ClaimStatusChip } from '@/components/rewards/ClaimHistory';
import { shortAddr } from '@/lib/profiles';

function fmtXlm(value) {
  return (parseFloat(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

const BTN = 'flex-1 py-2.5 rounded-lg text-xs font-bold disabled:opacity-50';

// One claim in the review queue: approve it, reject it, or record the payout.
export default function ClaimReviewCard({ claim, wallet, onReviewed }) {
  const { toast } = useToast();
  const [note, setNote] = useState(claim.review_note || '');
  const [busy, setBusy] = useState(false);
  const mine = !!wallet && claim.wallet_address === wallet;

  const act = async (action) => {
    setBusy(true);
    try {
      if (action === 'paid') {
        await markClaimPaid({ claim, reviewer: wallet, wallet });
        toast({ title: `Marked ${fmtXlm(claim.amount_xlm)} XLM as paid` });
      } else {
        await reviewClaim({ claim, status: action, note, reviewer: wallet, wallet });
        toast({
          title: action === 'approved' ? 'Claim approved — pay it out by hand' : 'Claim rejected',
          description: action === 'rejected' ? 'Its rewards went back to the member to claim again.' : undefined,
        });
      }
      onReviewed?.();
    } catch (e) {
      toast({ title: 'Could not update the claim', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-lg font-bold text-[#00F59B]">{fmtXlm(claim.amount_xlm)} XLM</p>
          <p className="text-[10px] font-mono text-[#F2F7F4]/40 truncate">
            {shortAddr(claim.wallet_address)} · {claim.wallet_address}
          </p>
        </div>
        <ClaimStatusChip status={claim.status} />
      </div>

      <p className="text-[10px] text-[#F2F7F4]/45">
        {claim.event_count || 0} rewarded {claim.event_count === 1 ? 'action' : 'actions'} · submitted{' '}
        {new Date(claim.created_date).toLocaleString()}
      </p>

      {mine ? (
        <p className="text-[11px] text-[#ffb020] bg-[#ffb020]/10 border border-[#ffb020]/30 rounded-xl p-3">
          This is your own claim — someone else has to review it.
        </p>
      ) : (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reviewer note (optional)"
            className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-[#00F59B]/40"
          />
          <div className="flex gap-2">
            {claim.status === 'pending' && (
              <>
                <button
                  onClick={() => act('approved')}
                  disabled={busy}
                  className={`${BTN} bg-[#00F59B] text-[#04100B]`}
                >
                  Approve
                </button>
                <button
                  onClick={() => act('rejected')}
                  disabled={busy}
                  className={`${BTN} bg-[#ff3b5c]/15 text-[#ff3b5c] border border-[#ff3b5c]/30`}
                >
                  Reject
                </button>
              </>
            )}
            {claim.status === 'approved' && (
              <button
                onClick={() => act('paid')}
                disabled={busy}
                className={`${BTN} bg-[#00F59B] text-[#04100B]`}
              >
                {busy ? 'Saving…' : 'Mark as paid'}
              </button>
            )}
            {(claim.status === 'paid' || claim.status === 'rejected') && (
              <p className="text-[10px] text-[#F2F7F4]/40">
                Settled{claim.reviewed_date ? ` on ${new Date(claim.reviewed_date).toLocaleDateString()}` : ''}.
              </p>
            )}
          </div>
        </>
      )}

      {!mine && claim.status !== 'pending' && claim.review_note && (
        <p className="text-[10px] text-[#F2F7F4]/45">Reviewer note: {claim.review_note}</p>
      )}
    </div>
  );
}