import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '@/components/PageLayout';
import TokenCard from '@/components/TokenCard';
import WalletButton from '@/components/WalletButton';
import { fetchAssetStats } from '@/lib/stellar';
import { useWallet } from '@/lib/wallet';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import NewHoldersToday from '@/components/NewHoldersToday';
import Leaderboard from '@/components/Leaderboard';

const TABS = [
  { key: 'hot', label: '🔥 Hot' },
  { key: 'new', label: '✨ New' },
  { key: 'holders', label: '🏆 Holders' },
];

export default function Home() {
  const { wallet } = useWallet();
  const [tab, setTab] = useState('hot');
  const [allTokens, setAllTokens] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      let list = await base44.entities.Token.list('-created_date', 100);
      if (!active) return;
      setAllTokens(list);
      setLoading(false);

      // Enrich with live on-chain data (first 20 tokens)
      const toEnrich = list.slice(0, 20).filter((t) => t.issuer && t.asset_code);
      for (const t of toEnrich) {
        try {
          const stats = await fetchAssetStats(t.asset_code, t.issuer);
          if (!active) return;
          setAllTokens((prev) =>
            prev.map((p) =>
              p.id === t.id
                ? {
                    ...p,
                    holders: stats.holders || p.holders,
                    volume_24h: stats.volume24h || p.volume_24h || 0,
                    price: stats.price > 0 ? stats.price : p.price,
                    market_cap: stats.price > 0 ? stats.price * (p.supply || 0) : p.market_cap,
                  }
                : p
            )
          );
        } catch {
          /* skip */
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let list = [...allTokens];
    if (tab === 'hot') list = list.sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));
    else if (tab === 'holders') list = list.sort((a, b) => (b.holders || 0) - (a.holders || 0));
    else {
      const now = new Date();
      const startOfDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      list = list
        .filter((t) => new Date(t.created_date).getTime() >= startOfDay)
        .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    }
    setTokens(list);
  }, [tab, allTokens]);

  return (
    <PageLayout
      title="Stellar Pump"
      rightAction={
        <div className="flex items-center gap-2">
          <Link to="/guide" className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10 transition">
            <HelpCircle size={18} className="text-white/70" />
          </Link>
          <WalletButton />
        </div>
      }
    >
      <div className="flex gap-1 p-3 sticky top-14 z-20 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${
              tab === t.key ? 'bg-[#00ff88] text-black' : 'bg-white/5 text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
        </div>
      ) : tokens.length === 0 ? (
        <p className="text-center text-white/40 py-20 text-sm">No tokens yet. Launch the first one!</p>
      ) : (
        <div>
          {tokens.map((t, i) => (
            <TokenCard key={t.id} token={t} rank={i + 1} />
          ))}
        </div>
      )}
      {!loading && allTokens.length > 0 && (
        <div className="px-3 pt-4 space-y-3">
          <NewHoldersToday tokens={allTokens} />
          <Leaderboard tokens={allTokens} walletAddress={wallet?.address} />
        </div>
      )}
    </PageLayout>
  );
}