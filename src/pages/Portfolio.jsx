import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import TokenIcon from '@/components/TokenIcon';

export default function Portfolio() {
  const { wallet } = useWallet();
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!wallet) {
        setLoading(false);
        return;
      }
      const list = await base44.entities.Trade.filter({ user_address: wallet.address }, '-created_date', 200);
      setTrades(list);
      setLoading(false);
    })();
  }, [wallet]);

  const holdings = {};
  trades.forEach((t) => {
    if (!holdings[t.token_id])
      holdings[t.token_id] = { symbol: t.token_symbol, name: t.token_name, tokens: 0, cost: 0 };
    const h = holdings[t.token_id];
    if (t.type === 'buy') {
      h.tokens += t.tokens;
      h.cost += t.amount_xlm;
    } else {
      h.tokens -= t.tokens;
      h.cost -= t.amount_xlm;
    }
  });
  const activeHoldings = Object.values(holdings).filter((h) => h.tokens > 0.0001);

  return (
    <PageLayout title="Portfolio" rightAction={<WalletButton />}>
      {!wallet ? (
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <p className="text-white/50">Connect your wallet to view your portfolio</p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="bg-gradient-to-br from-[#00ff88]/10 to-[#141518] rounded-2xl p-5 border border-[#00ff88]/20">
            <div className="text-xs text-white/40">Balance</div>
            <div className="text-3xl font-bold mt-1">
              {wallet.balance.toFixed(2)} <span className="text-base text-white/50">XLM</span>
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-2 px-1">Holdings</h3>
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
              </div>
            ) : activeHoldings.length === 0 ? (
              <p className="text-sm text-white/30 px-1">No active holdings yet.</p>
            ) : (
              activeHoldings.map((h, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-3 bg-[#141518] rounded-xl mb-2">
                  <TokenIcon token={h} size={36} />
                  <div className="flex-1">
                    <div className="font-semibold text-sm">${h.symbol}</div>
                    <div className="text-xs text-white/40">{h.tokens.toFixed(2)} tokens</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">{h.cost.toFixed(2)} XLM</div>
                    <div className="text-xs text-white/40">cost basis</div>
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
      )}
    </PageLayout>
  );
}