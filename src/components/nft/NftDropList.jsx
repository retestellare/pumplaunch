import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import NftCard from './NftCard';

export default function NftDropList() {
  const [collections, setCollections] = useState(null);

  const load = useCallback(async () => {
    const list = await base44.entities.NftCollection.list('-created_date', 100);
    setCollections(list);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (updated) =>
    setCollections((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));

  if (collections === null) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center py-16 px-6 space-y-3">
        <p className="text-sm text-white/50">No NFT drops yet.</p>
        <Link
          to="/launch-nft"
          className="inline-block px-5 py-2.5 rounded-xl bg-[#00ff88] text-black text-sm font-bold"
        >
          Launch the first collection
        </Link>
      </div>
    );
  }

  // Live drops first, then the newest.
  const sorted = [...collections].sort(
    (a, b) => Number(a.status === 'sold_out') - Number(b.status === 'sold_out')
  );

  return (
    <div className="p-3 space-y-3">
      {sorted.map((c) => (
        <NftCard key={c.id} collection={c} onMinted={update} />
      ))}
    </div>
  );
}