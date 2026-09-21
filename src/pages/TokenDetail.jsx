import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TokenIcon from '@/components/TokenIcon';
import SimpleChart from '@/components/SimpleChart';
import TradingPanel from '@/components/TradingPanel';
import OpenOrders from '@/components/OpenOrders';
import BottomNav from '@/components/BottomNav';
import { fetchAssetStats, formatOnChainTrades, fetchPoolPrice, fetchOrderBook } from '@/lib/stellar';
import SeedPoolPanel from '@/components/SeedPoolPanel';
import TokenInfoCards from '@/components/TokenInfoCards';

export default function TokenDetail() {
  const { id } = useParams();
  const [token, setToken] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [liveTrades, setLiveTrades] = useState([]);
  const [ordersKey, setOrdersKey] = useState(0);
  const [poolInfo, setPoolInfo] = useState(null);
  const [orderBook, setOrderBook] = useState(null);
  const [poolMissing, setPoolMissing] = useState(false);

  const load = async () => {
    const t = await base44.entities.Token.get(id);
    setToken(t);
    setPoolInfo(null);
    setOrderBook(null);
    setPoolMissing(false);
    setOrdersKey((k) => k + 1);

    if (t.issuer && t.asset_code) {
      try {
        const stats = await fetchAssetStats(t.asset_code, t.issuer);
        setLiveStats(stats);
        setLiveTrades(formatOnChainTrades(stats.trades, t.asset_code, t.issuer));
      } catch {
        /* fall back to database values */
      }
      if (t.is_auto_pool) {
        try {
          const pool = await fetchPoolPrice(t.asset_code, t.issuer);
          if (pool) setPoolInfo(pool);
          else setPoolMissing(true);
        } catch {
          setPoolMissing(true);
        }
      }
      try {
        setOrderBook(await fetchOrderBook(t.asset_code, t.issuer));
      } catch {
        setOrderBook(null);
      }
    }
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

  const price = poolInfo && poolInfo.price > 0
    ? poolInfo.price
    : liveStats && liveStats.price > 0 ? liveStats.price : token.price || 0.000001;
  const holders = liveStats ? liveStats.holders : token.holders || 1;
  const volume24h = liveStats ? liveStats.volume24h : token.volume_24h || 0;
  const marketCap = price * (token.supply || 0);
  const positive = (token.change_24h || 0) >= 0;

  const history =
    liveStats && liveStats.priceHistory && liveStats.priceHistory.length > 1
      ? liveStats.priceHistory
      : (() => {
          const arr = [];
          const seed = (token.symbol || 'x').charCodeAt(0);
          let p = price * 0.4;
          for (let i = 0; i < 40; i++) {
            p = p * (1 + (((seed + i * 7) % 10) / 10 - 0.45) * 0.25);
            arr.push(p);
          }
          arr.push(price);
          return arr;
        })();

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-20">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/" className="text-white/70">
            <ChevronLeft size={22} />
          </Link>
          <div className="flex items-center gap-2">
            <TokenIcon token={token} size={28} />
            <span className="font-bold">${token.symbol}</span>
          </div>
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
            <span className="text-3xl font-bold">{price.toFixed(8)} XLM</span>
            <span
              className={`text-sm font-bold pb-1 ${positive ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}
            >
              {positive ? '+' : ''}
              {(token.change_24h || 0).toFixed(2)}%
            </span>
          </div>
          <div className="mt-3">
            <SimpleChart data={history} color={positive ? '#00ff88' : '#ff3b5c'} height={80} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Mkt Cap', value: `${(marketCap / 1000).toFixed(1)}K XLM` },
            { label: 'Holders', value: holders },
            { label: 'Vol 24h', value: `${(volume24h / 1000).toFixed(1)}K XLM` },
          ].map((s) => (
            <div key={s.label} className="bg-[#141518] rounded-xl p-3 text-center">
              <div className="text-xs text-white/40">{s.label}</div>
              <div className="text-sm font-bold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>

        <TokenInfoCards token={token} liveStats={liveStats} poolInfo={poolInfo} orderBook={orderBook} />

        {token.is_auto_pool && poolMissing && (
          <SeedPoolPanel token={token} onSeeded={load} />
        )}
        <TradingPanel token={token} marketPrice={price} onTrade={load} />
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
      <BottomNav />
    </div>
  );
}