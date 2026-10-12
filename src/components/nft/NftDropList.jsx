import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Image } from '@/components/ui/image';
import NftCard from './NftCard';
import { mapLimit } from '@/lib/concurrency';
import { fetchCollectionState, isOnChain } from '@/lib/nftLaunch';
import { PANEL_IMAGE } from '@/lib/brandAssets';

export default function NftDropList() {
  const [collections, setCollections] = useState(null);
  const [saleStates, setSaleStates] = useState({});

  const load = useCallback(async () => {
    const list = await base44.entities.NftCollection.list('-created_date', 100);
    setCollections(list);

    // On-chain collections report their real progress from the network, so the
    // bars and the mint buttons can never drift from what is really left.
    const chain = list.filter(isOnChain);
    if (chain.length === 0) return;
    const results = await mapLimit(chain, 4, (c) => fetchCollectionState(c).catch(() => null));
    const byId = {};
    chain.forEach((c, i) => {
      byId[c.id] = results[i];
    });
    setSaleStates(byId);
    setCollections((prev) =>
      prev.map((c) => {
        const state = byId[c.id];
        if (!state) return c;
        const minted = Math.min(c.total_supply || 1, Math.max(c.minted_count || 0, state.minted));
        return {
          ...c,
          minted_count: minted,
          status: minted >= (c.total_supply || 1) ? 'sold_out' : c.status,
        };
      })
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (updated) =>
    setCollections((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));

  if (collections === null) {
    return (
      <div className="w-[22px] h-[22px] border-2 border-[#16211E] border-t-[#00F59B] rounded-full animate-spin mx-auto my-3.5" />
    );
  }

  if (collections.length === 0) {
    return (
      <div className="mt-3.5 mx-3 bg-[#101816] border border-[#16211E] rounded-[14px] overflow-hidden">
        <div className="h-[70px]">
          <Image src={PANEL_IMAGE} alt="" fittingType="fill" className="w-full h-full" />
        </div>
        <div className="px-4 py-4 text-center text-[12px] text-[#F2F7F4]/40">
          No NFT drops yet.
          <br />
          <Link
            to="/launch-nft"
            className="inline-block mt-2.5 px-[18px] py-2.5 rounded-[12px] bg-[#00F59B] text-[#04100B] text-[12px] font-black transition duration-200 hover:shadow-[0_0_14px_rgba(0,245,155,.6)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
          >
            Launch the first collection
          </Link>
        </div>
      </div>
    );
  }

  // Live drops first, then the newest.
  const sorted = [...collections].sort(
    (a, b) => Number(a.status === 'sold_out') - Number(b.status === 'sold_out')
  );

  return (
    <div className="px-3 pt-3.5 space-y-3">
      {sorted.map((c) => (
        <NftCard key={c.id} collection={c} state={saleStates[c.id]} onMinted={update} />
      ))}
    </div>
  );
}