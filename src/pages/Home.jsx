import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '@/components/PageLayout';
import TokenCard from '@/components/TokenCard';
import WalletButton from '@/components/WalletButton';

const TABS = [
  { key: 'hot', label: '🔥 Hot' },
  { key: 'new', label: '✨ New' },
  { key: 'holders', label: '🏆 Holders' },
];

export default function Home() {
  const [tab, setTab] = useState('hot');
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let list = await base44.entities.Token.list('-created_date', 100);
      if (tab === 'hot') list = [...list].sort((a, b) => (b.volume_24h || 0) - (a.volume_24h || 0));
      else if (tab === 'holders') list = [...list].sort((a, b) => (b.holders || 0) - (a.holders || 0));
      else list = [...list].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      setTokens(list);
      setLoading(false);
    })();
  }, [tab]);

  return (
    <PageLayout title="Stellar Pump" rightAction={<WalletButton />}>
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
    </PageLayout>
  );
}