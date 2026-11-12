import { useEffect } from 'react';
import { useWallet } from '@/lib/wallet';
import { attributeReferral, captureReferralFromUrl } from '@/lib/referrals';
import { syncReferralRewards } from '@/lib/referralRewards';

// Headless: remembers an incoming referral link, credits it to the inviter's
// wallet, and lets the backend pay both sides as soon as this profile is complete.
export default function RewardTracker() {
  const { wallet } = useWallet();

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  useEffect(() => {
    if (!wallet?.address) return;
    const address = wallet.address;
    attributeReferral(address)
      .then(() => syncReferralRewards(address))
      .catch(() => {});
  }, [wallet?.address]);

  return null;
}