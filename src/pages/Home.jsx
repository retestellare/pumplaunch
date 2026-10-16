import { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import PageLayout from '@/components/PageLayout';
import TokenCard from '@/components/TokenCard';
import WalletButton from '@/components/WalletButton';
import { Image } from '@/components/ui/image';
import { useWallet } from '@/lib/wallet';
import { Link } from 'react-router-dom';
import { Gift, HelpCircle } from 'lucide-react';
import NewHoldersToday from '@/components/NewHoldersToday';
import Leaderboard from '@/components/Leaderboard';
import { fetchTokenMarket } from '@/lib/market';
import { byLiquidityGrowth } from '@/lib/liquidity';
import { mapLimit } from '@/lib/concurrency';
import PullToRefresh from '@/components/PullToRefresh';
import NftDropList from '@/components/nft/NftDropList';
import { HERO_IMAGE, MASCOT_IMAGE } from '@/lib/brandAssets';
import MarketTicker from '@/components/ticker/MarketTicker';
import FlashNews from '@/components/FlashNews';
import SettingsMenu from '@/components/settings/SettingsMenu';

const MODES = [
  { key: 'coins', label: '🐸 Memecoins' },
  { key: 'nft', label: '🖼️ NFT Drops' },
];

const TABS = [
  { key: 'hot', label: '🔥 Hot' },
  { key: 'new', label: '✨ New' },
  { key: 'holders', label: '🏆 Holders' },
];

const ENRICH_CONCURRENCY = 6;
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

function enrich(token, stats, market, liquidity) {
  const price = market?.price > 0 ? market.price : null;
  return {
    ...token,
    holders: stats.holders || 0,
    volume_24h: stats.volume24h || 0,
    change_24h: stats.change24h,
    liquidity_change_24h: liquidity?.changePct ?? null,
    price: price != null ? price : token.price,
    market_cap: price != null ? price * (token.supply || 0) : token.market_cap,
  };
}

const createdTime = (t) => new Date(t.created_date).getTime();

export default function Home() {
  const { wallet } = useWallet();
  const [mode, setMode] = useState('coins');
  const [tab, setTab] = useState('hot');
  const [allTokens, setAllTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    const list = await base44.entities.Token.list('-created_date', 100);
    setAllTokens(list);
    setLoading(false);

    // Live figures stream in afterwards — the list never waits on Horizon.
    setEnriching(true);
    await mapLimit(list.filter((t) => t.issuer && t.asset_code), ENRICH_CONCURRENCY, async (t) => {
      const { stats, market, liquidity } = await fetchTokenMarket(t);
      if (!stats) return;
      setAllTokens((prev) => prev.map((p) => (p.id === t.id ? enrich(p, stats, market, liquidity) : p)));
    });
    setEnriching(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const tokens = useMemo(() => {
    const list = [...allTokens];
    // Hot ranks by how much a token's pools deepened over the last day — the same
    // figure each row shows.
    if (tab === 'hot')
      return list.sort(
        (a, b) =>
          byLiquidityGrowth(a, b) ||
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
    <PageLayout bare>
      <PullToRefresh onRefresh={load} />
      <section className="relative min-h-[300px] overflow-hidden">
        <div className="absolute inset-0">
          <Image src={HERO_IMAGE} alt="" fittingType="fill" className="w-full h-full" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,11,10,.55),#080B0A_96%)]" />
        <div className="relative px-3.5 pt-[calc(0.875rem+env(safe-area-inset-top))] pb-4">
          <div className="flex items-center justify-between gap-2 animate-[sp-up_.6s_ease-out_both]">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                aria-label="Settings"
                className="shrink-0 rounded-full transition duration-200 hover:shadow-[0_0_14px_rgba(0,245,155,.65)] active:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
              >
                <Image
                  src={MASCOT_IMAGE}
                  alt=""
                  fittingType="fill"
                  className="w-[26px] h-[26px] rounded-full border border-[#00F59B]/45 shadow-[0_0_12px_rgba(0,245,155,.5)]"
                />
              </button>
              {/* The wallet balances want this space too: on the narrowest
                  screens the mascot carries the brand on its own. */}
              <span className="hidden min-[390px]:inline font-display text-[15px] tracking-[.01em] uppercase text-[#00F59B] [text-shadow:0_0_12px_rgba(0,245,155,.6)] truncate">
                Stellar Pump
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/rewards"
                aria-label="Rewards"
                className="w-[34px] h-[34px] rounded-[10px] bg-[#16211E] border border-[#00F59B]/25 text-[#00F59B] flex items-center justify-center transition duration-200 hover:bg-[#1d2d29] hover:shadow-[0_0_10px_rgba(0,245,155,.4)] active:bg-[#0e1614] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
              >
                <Gift size={18} />
              </Link>
              <Link
                to="/guide"
                aria-label="Guide"
                className="w-[34px] h-[34px] rounded-[10px] bg-[#16211E] border border-[#00F59B]/25 text-[#00F59B] flex items-center justify-center transition duration-200 hover:bg-[#1d2d29] hover:shadow-[0_0_10px_rgba(0,245,155,.4)] active:bg-[#0e1614] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
              >
                <HelpCircle size={18} />
              </Link>
              <WalletButton />
            </div>
          </div>
          <div className="mt-[54px] animate-[sp-up_.6s_.08s_ease-out_both]">
            <FlashNews tokens={allTokens} />
            <MarketTicker tokens={allTokens} />
          </div>
          <div className="mt-2.5 animate-[sp-up_.6s_.1s_ease-out_both]">
            <div className="flex gap-1 p-1 rounded-[14px] bg-[#16211E]/85 border border-[#00F59B]/20 backdrop-blur-[8px]">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setMode(m.key)}
                  className={`flex-1 py-3 rounded-[10px] font-black text-[12px] tracking-[.08em] uppercase transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B] ${
                    mode === m.key
                      ? 'bg-[#16211E] text-[#F2F7F4] shadow-[inset_0_0_0_1px_#00F59B,0_0_16px_rgba(0,245,155,.35)]'
                      : 'bg-transparent text-[#F2F7F4]/50 hover:text-[#F2F7F4]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {mode === 'coins' && (
              <div className="flex gap-1.5 mt-2.5 animate-[sp-up_.6s_.2s_ease-out_both]">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex-1 py-2.5 rounded-[10px] border font-extrabold text-[11px] tracking-[.06em] uppercase transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B] ${
                      tab === t.key
                        ? 'bg-[#00F59B] text-[#04100B] border-[#00F59B] shadow-[0_0_14px_rgba(0,245,155,.5)]'
                        : 'bg-[#101816] text-[#F2F7F4]/65 border-[#16211E] hover:shadow-[0_0_10px_rgba(0,245,155,.35)]'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      {mode === 'nft' ? (
        <NftDropList />
      ) : loading ? (
        <div className="w-[22px] h-[22px] border-2 border-[#16211E] border-t-[#00F59B] rounded-full animate-spin mx-auto my-3.5" />
      ) : tokens.length === 0 ? (
        <p className="px-4 py-4 text-center text-[12px] text-[#F2F7F4]/40">
          No tokens yet. Launch the first one!
        </p>
      ) : (
        <div className="border-t border-[#16211E]">
          {tokens.map((t, i) => (
            <TokenCard key={t.id} token={t} index={i} rank={enriching ? null : i + 1} />
          ))}
        </div>
      )}
      {mode === 'coins' && allTokens.length > 0 && (
        <div className="px-3 pt-3 space-y-3">
          <NewHoldersToday tokens={allTokens} />
          <Leaderboard tokens={allTokens} walletAddress={wallet?.address} />
        </div>
      )}
      <SettingsMenu open={showSettings} onOpenChange={setShowSettings} />
    </PageLayout>
  );
}