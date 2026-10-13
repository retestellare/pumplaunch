import { useEffect } from 'react';
import { useWallet } from '@/lib/wallet';
import { attributeReferral, captureReferralFromUrl } from '@/lib/referrals';

// Headless: remembers an incoming referral link, then credits the inviter the
// first time the invited wallet appears in the app.
export default function RewardTracker() {
  const { wallet } = useWallet();

  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  useEffect(() => {
    if (!wallet?.address) return;
    attributeReferral(wallet.address).catch(() => {});
  }, [wallet?.address]);

  return null;
}