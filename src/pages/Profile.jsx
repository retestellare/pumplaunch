import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { resolveProfile, resolveProfiles, shortAddr } from '@/lib/profiles';
import Avatar from '@/components/Avatar';
import PostCard from '@/components/PostCard';
import BottomNav from '@/components/BottomNav';

export default function Profile() {
  const { walletAddress } = useParams();
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const p = await resolveProfile(walletAddress);
      if (!active) return;
      setProfile(p);
      try {
        const list = await base44.entities.Post.filter({ author: walletAddress }, '-created_date', 50);
        if (!active) return;
        setPosts(list || []);
        const map = await resolveProfiles([walletAddress]);
        if (active) setProfileMap(map);
      } catch {
        /* ignore */
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [walletAddress]);

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/social" className="text-white/70">
            <ChevronLeft size={22} />
          </Link>
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
              {profile?.bio && (
                <p className="text-sm text-white/60 mt-3 whitespace-pre-wrap">{profile.bio}</p>
              )}
              {!profile?.bio && !profile?.display_name && (
                <p className="text-sm text-white/40 mt-3">No profile set up yet.</p>
              )}
              <div className="mt-3 text-xs text-white/40">
                {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-2 px-1">Posts</h3>
              {posts.length === 0 ? (
                <p className="text-sm text-white/30 px-1 py-6 text-center">No posts yet.</p>
              ) : (
                posts.map((p) => (
                  <PostCard key={p.id} post={p} profileMap={profileMap} onChange={() => {}} />
                ))
              )}
            </div>
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}