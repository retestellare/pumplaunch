import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { useWallet } from '@/lib/wallet';
import WalletButton from '@/components/WalletButton';
import RewardBalanceCard from '@/components/rewards/RewardBalanceCard';
import InviteLinkCard from '@/components/rewards/InviteLinkCard';
import RewardHistoryList from '@/components/rewards/RewardHistoryList';
import {
  confirmReferralPayout,
  referralStatus,
  requestReferralPayout,
  syncReferralRewards,
} from '@/lib/referralRewards';
import { claimDropWithTrustline } from '@/lib/plunch';
import { useRefreshTick } from '@/lib/appRefresh';

// The referral program: both wallets earn PLUNCH worth 1 XLM when an invited
// member completes a profile, and the whole balance leaves whenever the member
// asks for it.
export default function Rewards() {
  const { wallet, connect, connecting } = useWallet();
  const goBack = useGoBack('/');
  const tick = useRefreshTick();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState('idle'); // idle | sending | paid
  const [payout, setPayout] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (address) => {
    if (!address) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Anything that has just qualified is credited before the balance is read.
    await syncReferralRewards(address);
    const { data, error: failure } = await referralStatus(address);
    setStatus(data && !failure ? data : null);
    if (failure) setError(failure);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(wallet?.address);
  }, [wallet?.address, load, tick]);

  const request = async () => {
    if (!wallet?.address) return;
    setPhase('sending');
    setError('');
    try {
      const { data, error: failure } = await requestReferralPayout(wallet.address);
      if (failure) throw new Error(failure);

      let hash = data?.tx_hash || '';
      // A wallet without the PLUNCH line gets the tokens parked for it: one
      // approval opens the line and claims them into the same wallet.
      if (data?.claimable_balance_id) {
        const result = await claimDropWithTrustline({
          walletAddress: wallet.address,
          balanceId: data.claimable_balance_id,
        });
        hash = result?.hash || hash;
        await confirmReferralPayout(wallet.address, hash);
      }

      setPayout({ amount: data?.amount || 0, hash });
      setPhase('paid');
      load(wallet.address);
    } catch (err) {
      setPhase('idle');
      setError(err?.message || 'The request did not go through.');
    }
  };

  return (
    <div className="min-h-screen bg-[#080B0A] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#080B0A]/95 backdrop-blur border-b border-[#00F59B]/15 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-[#F2F7F4]/70">
            <ChevronLeft size={22} />
          </button>
          <h1 className="flex-1 font-display text-[15px] tracking-[.02em] uppercase text-[#00F59B]">Rewards</h1>
          <WalletButton />
        </div>
        <div className="h-[2px] bg-[linear-gradient(90deg,#00F59B,rgba(0,245,155,0)_70%)]" />
      </header>

      <main className="p-3.5 space-y-3">
        {!wallet ? (
          <section className="bg-[#141518] rounded-2xl p-5 text-center space-y-3">
            <p className="text-sm text-[#F2F7F4]/60">
              Connect a wallet to collect your referral rewards.
            </p>
            <button
              onClick={connect}
              disabled={connecting}
              className="w-full py-3.5 rounded-xl bg-[#00F59B] text-[#04100B] font-bold text-sm disabled:opacity-50"
            >
              {connecting ? 'Connecting…' : 'Connect Wallet'}
            </button>
          </section>
        ) : loading && !status ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/10 border-t-[#00F59B] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <RewardBalanceCard
              plunch={status?.plunch || 0}
              price={status?.price || 0}
              phase={phase}
              payout={payout}
              onRequest={request}
              error={error}
            />
            <InviteLinkCard wallet={wallet.address} invited={status?.invited || 0} />
            <RewardHistoryList items={status?.rewards || []} loading={loading} />
          </>
        )}
      </main>
    </div>
  );
}