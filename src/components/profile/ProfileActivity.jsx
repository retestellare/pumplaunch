import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import ProfileTabs from '@/components/profile/ProfileTabs';
import ProfileLaunches from '@/components/profile/ProfileLaunches';
import ProfileInvites from '@/components/profile/ProfileInvites';
import ProfileTrades from '@/components/profile/ProfileTrades';
import PostCard from '@/components/PostCard';

// Each list is fetched the first time its tab is opened, so a profile costs one
// call until the viewer actually asks for the launches, invites or trades.
const LOADERS = {
  tokens: (address) => base44.entities.Token.filter({ creator: address }, '-created_date', 30),
  invites: (address) =>
    base44.entities.Referral.filter({ referrer_wallet: address }, '-created_date', 50),
  trades: (address) =>
    base44.entities.Trade.filter({ user_address: address }, '-created_date', 40),
};

export default function ProfileActivity({ walletAddress, posts, profileMap, counts }) {
  const [tab, setTab] = useState('posts');
  const [lists, setLists] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLists({});
    setTab('posts');
  }, [walletAddress]);

  useEffect(() => {
    if (tab === 'posts' || lists[tab]) return;
    let active = true;
    setLoading(true);
    LOADERS[tab](walletAddress)
      .then((rows) => {
        if (active) setLists((prev) => ({ ...prev, [tab]: rows || [] }));
      })
      .catch(() => {
        if (active) setLists((prev) => ({ ...prev, [tab]: [] }));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, walletAddress, lists]);

  const tabs = [
    { key: 'posts', label: 'Posts', count: counts.posts },
    { key: 'tokens', label: 'Launches', count: counts.tokens },
    { key: 'invites', label: 'Invites', count: counts.invites },
    { key: 'trades', label: 'Trades', count: counts.trades },
  ];

  const list = lists[tab];

  return (
    <div className="space-y-3">
      <ProfileTabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'posts' ? (
        posts.length === 0 ? (
          <p className="text-sm text-white/30 px-1 py-6 text-center">No posts yet.</p>
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} profileMap={profileMap} onChange={() => {}} />
          ))
        )
      ) : loading || !list ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
        </div>
      ) : tab === 'tokens' ? (
        <ProfileLaunches tokens={list} />
      ) : tab === 'invites' ? (
        <ProfileInvites invites={list} />
      ) : (
        <ProfileTrades trades={list} />
      )}
    </div>
  );
}