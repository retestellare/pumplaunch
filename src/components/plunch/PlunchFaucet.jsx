import { useWallet } from '@/lib/wallet';
import PlunchFaucetCard from './PlunchFaucetCard';
import DailyPlunchClaim from './DailyPlunchClaim';

// The daily PLUNCH faucet: the listing card, then the claim card.
export default function PlunchFaucet() {
  const { wallet } = useWallet();

  return (
    <div className="space-y-2.5">
      <PlunchFaucetCard walletAddress={wallet?.address} />
      <DailyPlunchClaim />
    </div>
  );
}