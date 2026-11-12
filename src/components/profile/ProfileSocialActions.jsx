import { Link } from 'react-router-dom';
import { Inbox, MessageCircle } from 'lucide-react';
import { useWallet } from '@/lib/wallet';
import FollowButton from '@/components/social/FollowButton';

// Who this profile is to the viewer: follow them, write to them, or open your own
// inbox when you are looking at yourself.
export default function ProfileSocialActions({ walletAddress, onFollowChange }) {
  const { wallet, connect } = useWallet();
  const own = wallet?.address && wallet.address === walletAddress;

  if (own) {
    return (
      <div className="mt-3 flex items-center gap-2">
        <Link
          to="/inbox"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#00ff88] text-black text-xs font-bold"
        >
          <Inbox size={14} /> Inbox
        </Link>
        <Link
          to="/teams"
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white/80"
        >
          Teams
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      <FollowButton target={walletAddress} onChange={onFollowChange} />
      {wallet?.address ? (
        <Link
          to={`/messages/${walletAddress}`}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white/80 transition duration-200 hover:bg-white/15"
        >
          <MessageCircle size={14} /> Message
        </Link>
      ) : (
        <button
          onClick={connect}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white/80"
        >
          <MessageCircle size={14} /> Message
        </button>
      )}
    </div>
  );
}