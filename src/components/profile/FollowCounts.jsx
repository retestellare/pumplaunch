import { useEffect, useState } from 'react';
import { followCounts } from '@/lib/social';

// Followers and following, counted by the server for whichever wallet is on screen.
export default function FollowCounts({ walletAddress }) {
  const [counts, setCounts] = useState({ followers: 0, following: 0 });

  useEffect(() => {
    let active = true;
    followCounts(walletAddress)
      .then((c) => active && setCounts(c))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [walletAddress]);

  return (
    <div className="mt-2 flex items-center gap-4 text-xs text-white/40">
      <span>
        <b className="text-white/85">{counts.followers}</b> followers
      </span>
      <span>
        <b className="text-white/85">{counts.following}</b> following
      </span>
    </div>
  );
}