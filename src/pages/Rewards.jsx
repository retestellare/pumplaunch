import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { useWallet } from '@/lib/wallet';
import WalletButton from '@/components/WalletButton';
import RewardRulesCard from '@/components/rewards/RewardRulesCard';
import ReferralCard from '@/components/rewards/ReferralCard';
import RewardProgress from '@/components/rewards/RewardProgress';
import ClaimPanel from '@/components/rewards/ClaimPanel';
import ClaimHistory from '@/components/rewards/ClaimHistory';
import { loadClaims, loadProgress, loadRules, reviewerAccess } from '@/lib/rewards';

const EMPTY = { rows: {}, total: 0, claimable: 0, claimableCount: 0, referrals: 0 };

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-2 border-white/10 border-t-[#00F59B] rounded-full animate-spin" />
    </div>
  );
}

// The member's side of the program: what earns, what has been earned, the invite
// link, and the claim that turns rewarded activity into a manual payout.
export default function Rewards() {
  const { wallet, connect, connecting } = useWallet();
  const goBack = useGoBack('/');
  const [rules, setRules] = useState(null);
  const [progress, setProgress] = useState(EMPTY);
  const [claims, setClaims] = useState([]);
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (address) => {
    setLoading(true);
    const loadedRules = await loadRules();
    setRules(loadedRules);
    if (!address) {
      setProgress(EMPTY);
      setClaims([]);
      setCanReview(false);
      setLoading(false);
      return;
    }
    const [progressState, claimList, access] = await Promise.all([
      loadProgress(address),
      loadClaims(address),
      reviewerAccess(address),
    ]);
    setProgress(progressState);
    setClaims(claimList || []);
    setCanReview(access.allowed);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(wallet?.address);
  }, [wallet?.address, load]);

  const pending = claims.find((claim) => claim.status === 'pending') || null;

  return (
    <div className="min-h-screen bg-[#080B0A] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#080B0A]/95 backdrop-blur border-b border-[#00F59B]/15 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-[#F2F7F4]/70">
            <ChevronLeft size={22} />
          </button>
          <h1 className="flex-1 font-display text-[15px] tracking-[.02em] uppercase text-[#00F59B]">
            Rewards
          </h1>
          <WalletButton />
        </div>
        <div className="h-[2px] bg-[linear-gradient(90deg,#00F59B,rgba(0,245,155,0)_70%)]" />
      </header>

      <main className="p-3.5 space-y-3">
        {loading || !rules ? (
          <Spinner />
        ) : !wallet ? (
          <div className="bg-[#141518] rounded-2xl p-5 text-center space-y-3">
            <p className="text-sm text-[#F2F7F4]/60">
              Connect a wallet to see your rewards, your referral link and your claims.
            </p>
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full py-3.5 rounded-xl bg-[#00F59B] text-[#04100B] font-bold text-sm disabled:opacity-50"
            >
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </div>
        ) : (
          <>
            <ReferralCard
              wallet={wallet.address}
              count={progress.referrals}
              rewardXlm={rules.referral_xlm}
            />
            <RewardProgress progress={progress} rules={rules} />
            <ClaimPanel
              wallet={wallet.address}
              progress={progress}
              rules={rules}
              pending={pending}
              onSubmitted={() => load(wallet.address)}
            />
            <ClaimHistory claims={claims} />
            <RewardRulesCard rules={rules} />
            {canReview && (
              <Link
                to="/rewards-admin"
                className="flex items-center justify-center gap-2 py-3.5 rounded-xl bg-white/5 border border-[#00F59B]/25 text-[#00F59B] text-xs font-bold tracking-[.06em] uppercase"
              >
                <ShieldCheck size={15} /> Review reward claims
              </Link>
            )}
          </>
        )}
      </main>
    </div>
  );
}