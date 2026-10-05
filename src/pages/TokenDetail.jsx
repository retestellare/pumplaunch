import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { base44 } from '@/api/base44Client';
import TokenIcon from '@/components/TokenIcon';
import SimpleChart from '@/components/SimpleChart';
import TradingPanel from '@/components/TradingPanel';
import OpenOrders from '@/components/OpenOrders';
import { formatOnChainTrades } from '@/lib/stellar';
import { fetchTokenMarket, ROUTE_LABEL } from '@/lib/market';
import SeedPoolPanel from '@/components/SeedPoolPanel';
import TokenInfoCards from '@/components/TokenInfoCards';
import PoolBadge from '@/components/PoolBadge';
import ShareButton from '@/components/ShareButton';
import TokenOgPreview from '@/components/TokenOgPreview';
import { tokenShare } from '@/lib/share';
import { ensureOgCard } from '@/lib/ogImage';

function fmtXlm(n, d = 2) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K XLM`;
  return `${Number(n).toLocaleString(undefined, { maximumFractionDigits: d })} XLM`;
}

export default function TokenDetail() {
  const { id } = useParams();
  const goBack = useGoBack();
  const [token, setToken] = useState(null);
  const [stats, setStats] = useState(null);
  const [market, setMarket] = useState(null);
  const [liveTrades, setLiveTrades] = useState([]);
  const [xlmPerUsdc, setXlmPerUsdc] = useState(0);
  const [ordersKey, setOrdersKey] = useState(0);
  const [ogCard, setOgCard] = useState(null);

  const load = async () => {
    const t = await base44.entities.Token.get(id);
    setToken(t);
    setStats(null);
    setMarket(null);
    setLiveTrades([]);
    setOrdersKey((k) => k + 1);

    // Every token gets its own share preview: generated once, then reused.
    const cardFor = (s, m) =>
      ensureOgCard(t, {
        price: m?.price,
        change24h: s?.change24h,
        marketCap: m?.price ? m.price * (t.supply || 0) : null,
        holders: s?.holders,
      });

    if (!t.issuer || !t.asset_code) {
      cardFor(null, null).then(setOgCard).catch(() => {});
      return;
    }

    // One call resolves every pool the token has, all normalised to XLM.
    const { stats: s, market: m, xlmPerUsdc: rate } = await fetchTokenMarket(t);
    setStats(s);
    setMarket(m);
    setXlmPerUsdc(rate);
    setLiveTrades(formatOnChainTrades(s.trades, t.asset_code, t.issuer, 20, rate));
    cardFor(s, m).then(setOgCard).catch(() => {});
  };

  useEffect(() => {
    load();
  }, [id]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
      </div>
    );
  }

  // One resolved price drives the header, market cap, cards and trade estimates.
  const price = market?.price > 0 ? market.price : null;
  const change24h = stats?.change24h != null ? stats.change24h : null;
  const positive = (change24h ?? 0) >= 0;
  const holders = stats ? stats.holders : token.holders ?? null;
  const volume24h = stats ? stats.volume24h : 0;
  const marketCap = price != null ? price * (token.supply || 0) : null;
  const history = stats?.priceHistory || [];

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-white/70">
            <ChevronLeft size={22} />
          </button>
          <div className="flex items-center gap-2">
            <TokenIcon token={token} size={28} />
            <span className="font-bold">${token.symbol}</span>
            <PoolBadge token={token} />
          </div>
          <ShareButton
            variant="icon"
            className="ml-auto"
            payload={tokenShare({ token, price, change24h })}
            imageFile={ogCard?.file}
          />
        </div>
      </header>
      <main className="p-4 space-y-4">
        <div className="bg-[#141518] rounded-2xl p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold">{token.name}</h2>
              <p className="text-sm text-white/40 mt-1">{token.description || 'A new memecoin on Stellar'}</p>
              {token.issuer && (
                <p className="text-[10px] text-white/30 mt-1 font-mono">
                  {token.asset_code || token.symbol} · {token.issuer.slice(0, 8)}…{token.issuer.slice(-4)}
                </p>
              )}
            </div>
            <TokenIcon token={token} size={56} />
          </div>
          <div className="flex items-end gap-2 mt-4">
            <span className="text-3xl font-bold">{price != null ? `${price.toFixed(8)} XLM` : '—'}</span>
            <span className={`text-sm font-bold pb-1 ${change24h == null ? 'text-white/30' : positive ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
              {change24h == null ? '—' : `${positive ? '+' : ''}${change24h.toFixed(2)}%`}
            </span>
          </div>
          <p className="text-[11px] text-white/40 mt-1">
            {price != null && market?.buyRoute
              ? `Best buy via ${ROUTE_LABEL[market.buyRoute]} · 24h change vs first fill today`
              : 'No liquidity yet — this token has no pool and no open offers.'}
          </p>
          <div className="mt-3">
            {history.length > 1 ? (
              <SimpleChart data={history} color={positive ? '#00ff88' : '#ff3b5c'} height={80} />
            ) : (
              <p className="text-[11px] text-white/30 pt-1">Not enough trades yet for a chart.</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Mkt Cap', value: marketCap != null ? fmtXlm(marketCap) : '—' },
            { label: 'Holders', value: holders != null ? holders : '—' },
            { label: 'Vol 24h', value: fmtXlm(volume24h) },
          ].map((s) => (
            <div key={s.label} className="bg-[#141518] rounded-xl p-3 text-center">
              <div className="text-xs text-white/40">{s.label}</div>
              <div className="text-sm font-bold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>

        {ogCard?.url && (
          <TokenOgPreview
            token={token}
            url={ogCard.url}
            imageFile={ogCard.file}
            price={price}
            change24h={change24h}
          />
        )}

        <TokenInfoCards token={token} stats={stats} market={market} />

        {token.is_auto_pool && market && !market.pool && <SeedPoolPanel token={token} onSeeded={load} />}
        <TradingPanel token={token} market={market} xlmPerUsdc={xlmPerUsdc} onTrade={load} />
        <OpenOrders token={token} refreshKey={ordersKey} />

        <div className="bg-[#141518] rounded-2xl p-4">
          <h3 className="font-bold mb-3">Recent Trades</h3>
          {liveTrades.length === 0 ? (
            <p className="text-sm text-white/30">No on-chain trades yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {liveTrades.map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className={t.type === 'buy' ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}>
                    {t.type === 'buy' ? 'Buy' : 'Sell'}
                  </span>
                  <span className="text-white/60">{t.tokens?.toFixed(1)} ${token.symbol}</span>
                  <span className="text-white/40">{t.amount_xlm?.toFixed(4)} XLM</span>
                  <span className="text-white/30 text-xs">
                    {new Date(t.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}