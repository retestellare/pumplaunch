import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, Lock } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import WalletButton from '@/components/WalletButton';
import ClaimReviewCard from '@/components/rewards/admin/ClaimReviewCard';
import RewardSettingsForm from '@/components/rewards/admin/RewardSettingsForm';
import { ClaimStatusChip } from '@/components/rewards/ClaimHistory';
import {
  claimOwnership,
  loadPendingClaims,
  loadRecentClaims,
  reviewerAccess,
} from '@/lib/rewards';
import { shortAddr } from '@/lib/profiles';

const MODE_LABEL = {
  'signed-in-admin': 'Signed in as an app admin',
  owner: 'Reviewer wallet',
  bootstrap: 'No reviewer wallet set',
  denied: 'Not a reviewer',
  'no-wallet': 'Wallet needed',
};

function fmtXlm(value) {
  return (parseFloat(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// The program's other half: claims are approved, rejected or marked paid here,
// and the rules are retuned without a deploy.
export default function RewardsAdmin() {
  const { wallet, connect, connecting } = useWallet();
  const goBack = useGoBack('/rewards');
  const { toast } = useToast();
  const [access, setAccess] = useState(null);
  const [pending, setPending] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const state = await reviewerAccess(wallet?.address);
    setAccess(state);
    if (state.allowed) {
      const [pendingList, recentList] = await Promise.all([loadPendingClaims(), loadRecentClaims()]);
      setPending(pendingList || []);
      setRecent(recentList || []);
    } else {
      setPending([]);
      setRecent([]);
    }
    setLoading(false);
  }, [wallet?.address]);

  useEffect(() => {
    load();
  }, [load]);

  const claimAccess = async () => {
    try {
      await claimOwnership(wallet.address);
      toast({ title: 'This wallet now runs the rewards program' });
      load();
    } catch (e) {
      toast({ title: 'Could not claim reviewer access', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-[#080B0A] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#080B0A]/95 backdrop-blur border-b border-[#00F59B]/15 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-[#F2F7F4]/70">
            <ChevronLeft size={22} />
          </button>
          <h1 className="flex-1 font-display text-[14px] tracking-[.02em] uppercase text-[#00F59B]">
            Rewards Admin
          </h1>
          <WalletButton />
        </div>
        {access && (
          <p className="px-4 pb-2 text-[10px] tracking-[.06em] uppercase text-[#F2F7F4]/35">
            {MODE_LABEL[access.mode]}
          </p>
        )}
      </header>

      <main className="p-3.5 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/10 border-t-[#00F59B] rounded-full animate-spin" />
          </div>
        ) : access?.mode === 'no-wallet' ? (
          <div className="bg-[#141518] rounded-2xl p-5 text-center space-y-3">
            <Lock className="mx-auto text-[#00F59B]" size={22} />
            <p className="text-sm text-[#F2F7F4]/60">
              Connect the wallet that runs the rewards program to review claims.
            </p>
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full py-3.5 rounded-xl bg-[#00F59B] text-[#04100B] font-bold text-sm disabled:opacity-50"
            >
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        ) : access?.mode === 'bootstrap' ? (
          <div className="bg-[#141518] rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-[#00F59B]" />
              <h2 className="text-sm font-bold">Claim ownership</h2>
            </div>
            <p className="text-xs text-[#F2F7F4]/60">
              No reviewer wallet is set yet. The first wallet to claim becomes the one that can review
              and pay out claims — do this from the wallet you want to run the program with.
            </p>
            <button
              onClick={claimAccess}
              className="w-full py-3.5 rounded-xl bg-[#00F59B] text-[#04100B] font-bold text-sm"
            >
              Claim reviewer access
            </button>
          </div>
        ) : !access?.allowed ? (
          <div className="bg-[#141518] rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-[#ff3b5c]" />
              <h2 className="text-sm font-bold">Reviewers only</h2>
            </div>
            <p className="text-xs text-[#F2F7F4]/60">
              This wallet is not listed as a rewards reviewer. A reviewer can add it from the rules
              below.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-bold">Waiting for review ({pending.length})</h2>
              {pending.length === 0 ? (
                <p className="text-xs text-[#F2F7F4]/40">Nothing to review right now.</p>
              ) : (
                pending.map((claim) => (
                  <ClaimReviewCard
                    key={claim.id}
                    claim={claim}
                    wallet={wallet?.address}
                    onReviewed={load}
                  />
                ))
              )}
            </div>

            <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
              <h2 className="text-sm font-bold">Recent claims</h2>
              {recent.length === 0 ? (
                <p className="text-xs text-[#F2F7F4]/40">No claims have been made yet.</p>
              ) : (
                <div className="space-y-2">
                  {recent.map((claim) => (
                    <div key={claim.id} className="bg-black/25 rounded-xl p-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold">{fmtXlm(claim.amount_xlm)} XLM</span>
                        <ClaimStatusChip status={claim.status} />
                      </div>
                      <p className="text-[10px] font-mono text-[#F2F7F4]/40">
                        {shortAddr(claim.wallet_address)} ·{' '}
                        {new Date(claim.created_date).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <RewardSettingsForm rules={access.rules} wallet={wallet?.address} onSaved={load} />
          </>
        )}
      </main>
    </div>
  );
}