import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronRight, Layers } from 'lucide-react';

// The way into the asset manager from the wallet: how many assets this wallet
// has launched, and what can be managed there.
export default function AssetManagerEntry({ address }) {
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!address) {
      setCount(null);
      return undefined;
    }
    let active = true;
    Promise.all([
      base44.entities.Token.count({ creator: address }),
      base44.entities.NftCollection.count({ creator: address }),
    ])
      .then(([tokens, collections]) => {
        if (active) setCount((tokens || 0) + (collections || 0));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [address]);

  return (
    <Link
      to="/manage"
      className="flex items-center gap-3 px-4 py-3 mb-3 bg-gradient-to-r from-[#00ff88]/10 to-[#141518] border border-[#00ff88]/20 rounded-2xl active:opacity-80 transition"
    >
      <Layers size={18} className="text-[#00ff88] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">Manage your assets</div>
        <div className="text-[11px] text-white/40 truncate">
          {count
            ? `${count} launched · registry, republish, liquidity`
            : 'Registry entry, republish, full liquidity detail'}
        </div>
      </div>
      <ChevronRight size={16} className="text-white/30 shrink-0" />
    </Link>
  );
}