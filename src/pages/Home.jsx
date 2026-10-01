import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '@/components/PageLayout';
import TokenCard from '@/components/TokenCard';
import WalletButton from '@/components/WalletButton';
import { useWallet } from '@/lib/wallet';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import NewHoldersToday from '@/components/NewHoldersToday';
import Leaderboard from '@/components/Leaderboard';
import { fetchTokenMarket } from '@/lib/market';
import { mapLimit } from '@/lib/concurrency';

const TABS = [
  { key: 'hot', label: '🔥 Hot' },
  { key: 'new', label: '✨ New' },
  { key: 'holders', label: '🏆 Holders' },
];

const ENRICH_CONCURRENCY = 6;
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

function enrich(token, stats, market) {
  const price = market?.price > 0 ? market.price : null;
  return {
    ...token,
    holders: stats.holders || 0,
    volume_24h: stats.volume24h || 0,
    change_24h: stats.change24h,
    price: price != null ? price : token.price,
    market_cap: price != null ? price * (token.supply || 0) : token.market_cap,
  };
}

const createdTime = (t) => new Date(t.created_date).getTime();

export default function Home() {
  const { wallet } = useWallet();
  const [tab, setTab] = useState('hot');
  const [allTokens, setAllTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const list = await base44.entities.Token.list('-created_date', 100);
      if (!active) return;
      setAllTokens(list);
      setLoading(false);

      // Live figures stream in afterwards — the list never waits on Horizon.
      setEnriching(true);
      await mapLimit(list.filter((t) => t.issuer && t.asset_code), ENRICH_CONCURRENCY, async (t) => {
        const { stats, market } = await fetchTokenMarket(t);
        if (!active || !stats) return;
        setAllTokens((prev) => prev.map((p) => (p.id === t.id ? enrich(p, stats, market) : p)));
      });
      if (active) setEnriching(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const tokens = useMemo(() => {
    const list = [...allTokens];
    if (tab === 'hot')
      return list.sort(
        (a, b) =>
          (b.volume_24h || 0) - (a.volume_24h || 0) ||
          (b.holders || 0) - (a.holders || 0) ||
          createdTime(b) - createdTime(a)
      );
    if (tab === 'holders')
      return list.sort(
        (a, b) => (b.holders || 0) - (a.holders || 0) || createdTime(b) - createdTime(a)
      );
    const cutoff = Date.now() - NEW_WINDOW_MS;
    const fresh = list.filter((t) => createdTime(t) >= cutoff).sort((a, b) => createdTime(b) - createdTime(a));
    return fresh.length > 0 ? fresh : list.slice(0, 20);
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
            <TokenCard key={t.id} token={t} rank={enriching ? null : i + 1} />
          ))}
        </div>
      )}
      {allTokens.length > 0 && (
        <div className="px-3 pt-4 space-y-3">
          <NewHoldersToday tokens={allTokens} />
          <Leaderboard tokens={allTokens} walletAddress={wallet?.address} />
        </div>
      )}
    </PageLayout>
  );
}