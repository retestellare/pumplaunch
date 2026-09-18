import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { loadAccount, parseBalances, fetchTokenMetadata } from '@/lib/stellar';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import TokenIcon from '@/components/TokenIcon';

export default function Portfolio() {
  const { wallet } = useWallet();
  const [balances, setBalances] = useState(null);
  const [enrichedAssets, setEnrichedAssets] = useState([]);
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet?.address) {
      setBalances(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [account, tradeList] = await Promise.all([
          loadAccount(wallet.address),
          base44.entities.Trade.filter({ user_address: wallet.address }, '-created_date', 50),
        ]);
        if (!active) return;
        setBalances(account ? parseBalances(account) : { xlm: 0, assets: [], availableXlm: 0 });
        setTrades(tradeList);
      } catch {
        if (active) setBalances({ xlm: 0, assets: [], availableXlm: 0 });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet?.address]);

  useEffect(() => {
    if (!balances?.assets?.length) {
      setEnrichedAssets([]);
      return;
    }
    let active = true;
    (async () => {
      let tokenMap = {};
      try {
        const appTokens = await base44.entities.Token.list('-created_date', 300);
        for (const t of appTokens) {
          if (t.issuer) tokenMap[t.issuer] = t;
        }
      } catch {
        /* ignore */
      }

      const enriched = await Promise.all(
        balances.assets.map(async (a) => {
          const appToken = tokenMap[a.issuer];
          if (appToken) {
            return {
              ...a,
              image_url: appToken.image_url,
              name: appToken.name,
              domain: appToken.custom_domain || appToken.home_domain,
              symbol: appToken.symbol,
            };
          }
          const meta = await fetchTokenMetadata(a.code, a.issuer);
          return {
            ...a,
            image_url: meta?.logo || null,
            name: meta?.name || a.code,
            domain: meta?.homeDomain || null,
            symbol: a.code,
          };
        })
      );
      if (active) setEnrichedAssets(enriched);
    })();
    return () => {
      active = false;
    };
  }, [balances]);

  if (!wallet) {
    return (
      <PageLayout title="Portfolio" rightAction={<WalletButton />}>
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <p className="text-white/50">Connect your wallet to view your portfolio</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Portfolio" rightAction={<WalletButton />}>
      <div className="p-4 space-y-4">
        <div className="bg-gradient-to-br from-[#00ff88]/10 to-[#141518] rounded-2xl p-5 border border-[#00ff88]/20">
          <div className="text-xs text-white/40">Total Balance</div>
          <div className="text-3xl font-bold mt-1">
            {loading ? '…' : (balances?.xlm || 0).toFixed(2)} <span className="text-base text-white/50">XLM</span>
          </div>
          {balances && balances.availableXlm < balances.xlm && (
            <div className="text-xs text-white/40 mt-1">
              {balances.availableXlm.toFixed(2)} XLM available
            </div>
          )}
        </div>

        <div>
          <h3 className="font-bold mb-2 px-1">Assets</h3>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
            </div>
          ) : !balances || balances.assets.length === 0 ? (
            <p className="text-sm text-white/30 px-1">No trustline assets yet.</p>
          ) : (
            (enrichedAssets.length > 0 ? enrichedAssets : balances.assets).map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 bg-[#141518] rounded-xl mb-2">
                <TokenIcon token={a} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">${a.symbol || a.code}</div>
                  <div className="text-xs text-white/40 truncate">
                    {a.domain || `${a.issuer.slice(0, 8)}…${a.issuer.slice(-4)}`}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{a.balance.toFixed(2)}</div>
                  <div className="text-xs text-white/40">{a.code}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div>
          <h3 className="font-bold mb-2 px-1">Recent Activity</h3>
          {trades.length === 0 ? (
            <p className="text-sm text-white/30 px-1">No trades yet.</p>
          ) : (
            trades.slice(0, 10).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between px-3 py-2.5 bg-[#141518] rounded-xl mb-2 text-sm"
              >
                <span className={t.type === 'buy' ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}>
                  {t.type === 'buy' ? 'Buy' : 'Sell'} ${t.token_symbol}
                </span>
                <span className="text-white/60">{t.amount_xlm?.toFixed(2)} XLM</span>
              </div>
            ))
          )}
        </div>
      </div>
    </PageLayout>
  );
}