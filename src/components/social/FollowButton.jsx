import { useEffect, useState } from 'react';
import { Check, Loader2, UserPlus } from 'lucide-react';
import { useWallet } from '@/lib/wallet';
import { followUser, isFollowing, unfollowUser } from '@/lib/social';

// Follow state lives on the chain of wallets, not on a session: the button reads
// it back for whoever is connected and toggles only that pair.
export default function FollowButton({ target, onChange, className = '' }) {
  const { wallet, connect } = useWallet();
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    isFollowing(wallet?.address, target)
      .then((v) => active && setFollowing(v))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [wallet?.address, target]);

  if (!target || target === wallet?.address) return null;

  const toggle = async () => {
    if (!wallet?.address) {
      connect();
      return;
    }
    setBusy(true);
    try {
      const next = following
        ? await unfollowUser(wallet.address, target)
        : await followUser(wallet.address, target);
      setFollowing(next);
      onChange?.(next ? 1 : -1);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-xl text-xs font-bold transition duration-200 disabled:opacity-60 ${
        following
          ? 'bg-white/10 text-white/80 border border-white/15'
          : 'bg-[#00ff88] text-black border border-[#00ff88]'
      } ${className}`}
    >
      {busy ? (
        <Loader2 size={14} className="animate-spin" />
      ) : following ? (
        <Check size={14} />
      ) : (
        <UserPlus size={14} />
      )}
      {following ? 'Following' : 'Follow'}
    </button>
  );
}