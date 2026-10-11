import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { loadAccount } from '@/lib/stellar';
import { loadAssetData } from '@/lib/assetData';
import { formatAmount, formatPrice } from '@/lib/candles';
import { absoluteUrl, tokenShare } from '@/lib/share';
import TokenIcon from '@/components/TokenIcon';
import PoolBadge from '@/components/PoolBadge';
import ShareButton from '@/components/ShareButton';
import WalletButton from '@/components/WalletButton';
import PriceChartCard from '@/components/charts/PriceChartCard';
import AssetPressure from '@/components/AssetPressure';

function fmtXlm(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K XLM`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`;
}

// The exploration screen behind every wallet asset: live on-chain price and
// stats, candlesticks, the pressure behind the price, and trading.
export default function WalletAsset() {
  const { code, issuer } = useParams();
  const goBack = useGoBack();
  const { wallet } = useWallet();
  const [data, setData] = useState(null);
  const [record, setRecord] = useState(null);
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [records, account, assetData] = await Promise.all([
      base44.entities.Token.filter({ asset_code: code, issuer }).catch(() => []),
      wallet?.address ? loadAccount(wallet.address).catch(() => null) : Promise.resolve(null),
      loadAssetData({ code, issuer, limit: 200 }).catch(() => null),
    ]);
    const rec = records?.[0] || null;
    setRecord(rec);
    const trustline = (account?.balances || []).find(
      (b) => b.asset_code === code && b.asset_issuer === issuer
    );
    setBalance(trustline ? parseFloat(trustline.balance) : 0);
    setData(assetData);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [code, issuer, wallet?.address]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0b0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
      </div>
    );
  }

  // A token launched here brings its record; any other Stellar asset is read
  // straight from the network, with its metadata coming from its own stellar.toml.
  const token = {
    ...record,
    asset_code: code,
    issuer,
    symbol: record?.symbol || code,
    name: record?.name || data?.meta?.name || code,
    image_url: record?.image_url || data?.meta?.logo || null,
    home_domain: record?.home_domain || data?.meta?.homeDomain || null,
    pools: data?.pools || ['xlm'],
  };
  const price = data?.price > 0 ? data.price : null;
  const change24h = data?.change24h != null ? data.change24h : null;
  const positive = (change24h ?? 0) >= 0;
  const value = price != null && balance != null ? price * balance : null;
  const supply = record?.supply || 0;
  const marketCap = price != null && supply > 0 ? price * supply : null;
  const fills = data?.fills || [];
  const recent = [...fills].reverse().slice(0, 20);
  const share = record
    ? tokenShare({ token, price, change24h })
    : {
        title: `$${token.symbol} on Stellar Pump`,
        text: `${token.name}${price != null ? ` — ${formatPrice(price)} XLM on the Stellar DEX` : ''}`,
        url: absoluteUrl(`/asset/${code}/${issuer}`),
      };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-white/70">
            <ChevronLeft size={22} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <TokenIcon token={token} size={28} />
            <span className="font-bold truncate">${token.symbol}</span>
            {record && <PoolBadge token={token} />}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ShareButton variant="icon" payload={share} />
            <WalletButton />
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <div className="bg-[#141518] rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs text-white/40">Your position</div>
              <div className="text-2xl font-bold mt-1">
                {formatAmount(balance)} <span className="text-sm text-white/50">${token.symbol}</span>
              </div>
              <div className="text-xs text-white/40 mt-1">
                {!wallet?.address
                  ? 'Connect a wallet to see your position'
                  : value != null
                  ? `≈ ${fmtXlm(value)}`
                  : balance > 0
                  ? 'No market prices this asset yet'
                  : 'Not in your wallet yet'}
              </div>
            </div>
            <TokenIcon token={token} size={48} />
          </div>
          <div className="border-t border-white/5 mt-4 pt-3 flex items-end justify-between">
            <div className="min-w-0">
              <div className="text-[11px] text-white/40 truncate">{token.name}</div>
              <div className="text-xl font-bold mt-0.5">
                {price != null ? formatPrice(price) : '—'} <span className="text-xs text-white/50">XLM</span>
              </div>
            </div>
            <span
              className={`text-sm font-bold shrink-0 ${
                change24h == null ? 'text-white/30' : positive ? 'text-[#00ff88]' : 'text-[#ff3b5c]'
              }`}
            >
              {change24h == null ? '24h —' : `${positive ? '+' : ''}${change24h.toFixed(2)}% 24h`}
            </span>
          </div>
          <p className="text-[10px] text-white/30 mt-2">
            {data?.market?.buyRoute
              ? `Best buy via ${data.market.buyRoute === 'pool' ? 'liquidity pool' : 'open offers'} · prices read live across every pool and book this asset trades in.`
              : 'No pool and no open offers are pricing this asset right now.'}
          </p>
        </div>

        <div className="bg-[#141518] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-white/80">Price</h3>
            <span className="text-[10px] text-white/30">{fills.length} recent fills</span>
          </div>
          <PriceChartCard fills={fills} height={150} />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Mkt Cap', value: marketCap != null ? fmtXlm(marketCap) : '—' },
            { label: 'Holders', value: data?.holders != null ? data.holders : '—' },
            { label: 'Vol 24h', value: data ? fmtXlm(data.volume24h) : '—' },
          ].map((s) => (
            <div key={s.label} className="bg-[#141518] rounded-xl p-3 text-center">
              <div className="text-xs text-white/40">{s.label}</div>
              <div className="text-sm font-bold mt-0.5">{s.value}</div>
            </div>
          ))}
        </div>

        <AssetPressure
          pressure={data?.pressure}
          depth={data?.depth}
          symbol={token.symbol}
          quote={data?.market?.buyQuote || 'xlm'}
        />

        <div className="bg-[#141518] rounded-2xl p-4">
          <h3 className="font-bold mb-3">Recent Trades</h3>
          {recent.length === 0 ? (
            <p className="text-sm text-white/30">No on-chain trades yet. Be the first!</p>
          ) : (
            <div className="space-y-2">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className={t.side === 'buy' ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}>
                    {t.side === 'buy' ? 'Buy' : 'Sell'}
                  </span>
                  <span className="text-white/60">{formatAmount(t.tokens)} ${token.symbol}</span>
                  <span className="text-white/40">{t.xlm.toFixed(4)} XLM</span>
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