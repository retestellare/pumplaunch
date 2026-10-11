import { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { fetchNftMarket } from '@/lib/nftMarket';
import { isOnChain } from '@/lib/nftLaunch';
import { quoteOf } from '@/lib/pools';
import { fmtAmount } from '@/lib/tradeQuote';
import NftBuyForm from './NftBuyForm';
import NftSellForm from './NftSellForm';

export default function NftTradePanel({ collection, onTraded }) {
  const { wallet } = useWallet();
  const [market, setMarket] = useState(null);
  const [side, setSide] = useState('buy');
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!isOnChain(collection)) return;
    try {
      setMarket(await fetchNftMarket(collection, { address: wallet?.address }));
    } catch {
      setFailed(true);
    }
  }, [collection.id, wallet?.address]);

  useEffect(() => {
    load();
  }, [load]);

  if (!isOnChain(collection)) {
    return (
      <p className="p-4 text-sm text-white/40">
        This collection is not on Stellar Mainnet yet, so its editions cannot be traded.
      </p>
    );
  }

  if (failed) {
    return <p className="p-4 text-sm text-white/40">Could not read this collection's market right now.</p>;
  }

  if (!market) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
      </div>
    );
  }

  const label = quoteOf(market.quote).label;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{collection.name}</p>
          <p className="text-[11px] text-white/40">
            ${collection.symbol} · editions trade on the Stellar DEX
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-[#00ff88]">
            {market.floor > 0 ? `${fmtAmount(market.floor, 6)} ${label}` : '—'}
          </p>
          <p className="text-[10px] text-white/30">floor price</p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-black/30 rounded-xl p-3 text-[11px] border border-white/5">
        <span className="text-white/50">
          {fmtAmount(market.listed, 2)} editions listed
        </span>
        <span className="text-white/50">
          Best bid {market.bestBid > 0 ? `${fmtAmount(market.bestBid, 6)} ${label}` : '—'}
        </span>
      </div>

      <div className="flex gap-2">
        {['buy', 'sell'].map((id) => (
          <button
            key={id}
            onClick={() => setSide(id)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
              side === id ? 'bg-[#00ff88] text-black' : 'bg-white/5 text-white/60'
            }`}
          >
            {id === 'buy' ? 'Buy' : 'Sell'}
          </button>
        ))}
      </div>

      {side === 'buy' ? (
        <NftBuyForm collection={collection} market={market} onDone={load} onTraded={onTraded} />
      ) : (
        <NftSellForm collection={collection} market={market} onDone={load} />
      )}
    </div>
  );
}