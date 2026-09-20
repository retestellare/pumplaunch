import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { resolveProfiles } from '@/lib/profiles';
import PageLayout from '@/components/PageLayout';
import PostCard from '@/components/PostCard';
import CreatePost from '@/components/CreatePost';
import { Plus } from 'lucide-react';

export default function Social() {
  const [posts, setPosts] = useState([]);
  const [profileMap, setProfileMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    const list = await base44.entities.Post.list('-created_date', 50);
    setPosts(list);
    setLoading(false);
    const map = await resolveProfiles((list || []).map((p) => p.author));
    setProfileMap(map);
  };
  useEffect(() => {
    load();
  }, []);

  return (
    <PageLayout title="Social Feed">
      {!showCreate ? (
        <div className="p-3">
          <button
            onClick={() => setShowCreate(true)}
            className="w-full mb-3 py-3 rounded-xl bg-[#00ff88] text-black font-bold text-sm flex items-center justify-center gap-2"
          >
            <Plus size={18} /> Share a Callout
          </button>
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <p className="text-center text-white/40 py-20 text-sm">No callouts yet. Share the first!</p>
          ) : (
            posts.map((p) => <PostCard key={p.id} post={p} onChange={load} profileMap={profileMap} />)
          )}
        </div>
      ) : (
        <CreatePost
          onDone={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </PageLayout>
  );
}