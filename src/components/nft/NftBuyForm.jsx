import { useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import { buyEditions, estimateBuy, estimateNftCost } from '@/lib/nftMarket';
import { quoteOf } from '@/lib/pools';
import { fmtAmount, toNumber } from '@/lib/tradeQuote';

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-white/50">{label}</span>
      <span className="font-bold text-white/90">{value}</span>
    </div>
  );
}

export default function NftBuyForm({ collection, market, onDone, onTraded }) {
  const { wallet, connect } = useWallet();
  const { toast } = useToast();
  const [count, setCount] = useState('1');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const quote = market.quote || 'xlm';
  const label = quoteOf(quote).label;
  const est = estimateBuy(market, toNumber(count));
  const editions = fmtAmount(est.quantity, 2);
  const cost = estimateNftCost('buy', { market, collection });
  // A USDC market is paid in USDC while the fee and any reserve still come from XLM.
  const payBalance = quote === 'usdc' ? market.usdc : market.availableXlm;
  const needed = quote === 'usdc' ? est.cost : est.cost + cost.feeXlm + cost.reserveXlm;
  const xlmNeeded = cost.feeXlm + cost.reserveXlm;
  const fundsOk = payBalance >= needed && market.availableXlm >= xlmNeeded;

  const start = () => {
    if (!wallet) {
      connect();
      return;
    }
    if (!(est.quantity > 0)) return;
    if (!est.enough) {
      toast({
        title: `Only ${fmtAmount(market.listed, 2)} editions are listed`,
        description: 'Lower the amount to what is on offer, or wait for new listings.',
        variant: 'destructive',
      });
      return;
    }
    if (!fundsOk) {
      toast({
        title: `Insufficient ${quote === 'usdc' && payBalance < needed ? label : 'XLM'}`,
        description: 'Top up this wallet on Stellar Mainnet and try again.',
        variant: 'destructive',
      });
      return;
    }
    setConfirming(true);
  };

  const execute = async () => {
    setBusy(true);
    try {
      const res = await buyEditions({
        address: wallet.address,
        collection,
        quantity: est.quantity,
        maxCost: est.cost,
      });
      onTraded?.(res.collection);
      setConfirming(false);
      setCount('1');
      toast({
        title: `Bought ${editions} ${est.quantity === 1 ? 'edition' : 'editions'}`,
        description: `$${collection.symbol} — paid about ${fmtAmount(est.cost, 6)} ${label} on Stellar Mainnet.`,
      });
      onDone?.();
    } catch (e) {
      toast({
        title: 'That purchase did not go through',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Editions to buy</label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          value={count}
          onChange={(e) => {
            setCount(e.target.value);
            setConfirming(false);
          }}
          disabled={busy}
          className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 disabled:opacity-40"
        />
      </div>

      <div className="bg-black/30 rounded-xl p-3 space-y-1.5 border border-white/5">
        <Row label="Cheapest listing" value={`${fmtAmount(market.floor, 6)} ${label}`} />
        <Row
          label="You pay"
          value={`${est.cost > 0 ? fmtAmount(est.cost, 6) : '—'} ${est.cost > 0 ? label : ''}`}
        />
        {est.quantity > 0 && est.filled > 0 && (
          <Row label="Average price" value={`${fmtAmount(est.avgPrice, 6)} ${label} each`} />
        )}
        <Row label="Listed right now" value={`${fmtAmount(market.listed, 2)} editions`} />
        {!est.enough && est.quantity > 0 && (
          <p className="text-[10px] text-[#ff3b5c] pt-0.5">
            {fmtAmount(est.shortfall, 2)} of those editions are not listed yet.
          </p>
        )}
        <Row label="Network fee" value={`~${cost.feeXlm.toFixed(7)} XLM`} />
        {cost.reserveXlm > 0 && (
          <Row label="Trustline reserve (locked)" value={`${cost.reserveXlm} XLM`} />
        )}
      </div>

      <p className="text-[10px] text-white/30">
        Editions are bought from whoever listed them — the creator's remaining drop or another
        holder. The seller is paid directly by the Stellar DEX.
      </p>

      {!confirming ? (
        <button
          onClick={start}
          disabled={busy || est.quantity <= 0 || !est.enough}
          className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
        >
          {!wallet ? 'Connect Wallet to Buy' : est.enough ? 'Review Buy' : 'Not enough listed'}
        </button>
      ) : (
        <div className="bg-[#00ff88]/5 rounded-xl p-3 space-y-2 border border-[#00ff88]/20">
          <Row label="Editions" value={String(est.quantity)} />
          <Row label="Total paid" value={`~${fmtAmount(est.cost, 6)} ${label}`} />
          {cost.reserveXlm > 0 && <Row label="New reserve" value={`${cost.reserveXlm} XLM`} />}
          <p className="text-[10px] text-white/50">
            A real Stellar Mainnet purchase: the editions land in your wallet and the payment is
            irreversible.
          </p>
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1 py-2.5 rounded-lg bg-white/5 text-xs font-bold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={execute}
              disabled={busy}
              className="flex-1 py-2.5 rounded-lg bg-[#00ff88] text-black text-xs font-bold disabled:opacity-50"
            >
              {busy ? 'Buying…' : 'Confirm buy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}