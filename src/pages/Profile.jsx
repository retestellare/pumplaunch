import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { base44 } from '@/api/base44Client';
import { resolveProfile, resolveProfiles, shortAddr } from '@/lib/profiles';
import { fetchTraderBoard } from '@/lib/leaderboard';
import { badgesFor } from '@/lib/badges';
import Avatar from '@/components/Avatar';
import TraderBadges from '@/components/TraderBadges';
import ProfileXLink from '@/components/profile/ProfileXLink';
import ProfileStats from '@/components/profile/ProfileStats';
import ProfileActivity from '@/components/profile/ProfileActivity';
import ProfileSocialActions from '@/components/profile/ProfileSocialActions';
import FollowCounts from '@/components/profile/FollowCounts';

// Every count is one number the server returns, so the page never loads a
// collection just to say how big it is.
const EMPTY_COUNTS = { posts: 0, tokens: 0, invites: 0, trades: 0 };

export default function Profile() {
  const { walletAddress } = useParams();
  const goBack = useGoBack('/social');
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [badges, setBadges] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setCounts(EMPTY_COUNTS);
      setPosts([]);
      const p = await resolveProfile(walletAddress);
      if (!active) return;
      setProfile(p);

      try {
        const [postList, postCount, tokenCount, inviteCount, tradeCount, map] = await Promise.all([
          base44.entities.Post.filter({ author: walletAddress }, '-created_date', 50),
          base44.entities.Post.count({ author: walletAddress }),
          base44.entities.Token.count({ creator: walletAddress }),
          base44.entities.Referral.count({ referrer_wallet: walletAddress }),
          base44.entities.Trade.count({ user_address: walletAddress }),
          resolveProfiles([walletAddress]),
        ]);
        if (!active) return;
        setPosts(postList || []);
        setCounts({
          posts: postCount || 0,
          tokens: tokenCount || 0,
          invites: inviteCount || 0,
          trades: tradeCount || 0,
        });
        setProfileMap(map);
      } catch {
        /* the profile card still renders without the lists */
      }
      if (active) setLoading(false);
      // Badges are read off the trader board, which is far slower to build than
      // the profile itself, so they land on their own instead of holding the page.
      try {
        const board = await fetchTraderBoard();
        if (active) setBadges(badgesFor(board, walletAddress));
      } catch {
        /* no board, no badges */
      }
    })();
    return () => {
      active = false;
    };
  }, [walletAddress]);

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-white/70">
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-lg font-bold tracking-tight">Profile</h1>
        </div>
      </header>
      <main className="p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="bg-[#141518] rounded-2xl p-5 flex flex-col items-center text-center">
              <Avatar profile={profile} address={walletAddress} size={80} />
              <h2 className="text-xl font-bold mt-3">
                {profile?.display_name || shortAddr(walletAddress)}
              </h2>
              <p className="text-xs text-white/30 font-mono mt-1">{shortAddr(walletAddress)}</p>
              {badges.length > 0 && (
                <div className="mt-2.5">
                  <TraderBadges keys={badges} labelled />
                </div>
              )}
              {profile?.bio && (
                <p className="text-sm text-white/60 mt-3 whitespace-pre-wrap">{profile.bio}</p>
              )}
              <ProfileXLink handle={profile?.x_handle} />
              {!profile?.bio && !profile?.display_name && (
                <p className="text-sm text-white/40 mt-3">No profile set up yet.</p>
              )}
              <ProfileStats counts={counts} />
              <FollowCounts walletAddress={walletAddress} />
              <ProfileSocialActions walletAddress={walletAddress} />
            </div>

            <ProfileActivity
              walletAddress={walletAddress}
              posts={posts}
              profileMap={profileMap}
              counts={counts}
            />
          </>
        )}
      </main>
    </div>
  );
}