import { useEffect, useState } from 'react';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import { cancelListing, estimateNftCost, listEditions } from '@/lib/nftMarket';
import { MIN_MINT_PRICE } from '@/lib/nftLaunch';
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

// Prices span nine orders of magnitude, so the default is written out in full
// instead of JavaScript's exponential form.
function plainPrice(n) {
  // Floored, not rounded: a price taken from the best bid has to reach that bid.
  // Rounding up would leave the offer sitting a hair above it, waiting forever.
  const v = Math.floor((Number(n) || 0) * 1e7) / 1e7;
  return v.toFixed(7).replace(/0+$/, '').replace(/\.$/, '');
}

export default function NftSellForm({ collection, market, onDone }) {
  const { wallet, connect } = useWallet();
  const { toast } = useToast();
  const [count, setCount] = useState('1');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  const quote = market.quote || 'xlm';
  const label = quoteOf(quote).label;
  const cost = estimateNftCost('sell', { market, collection });
  const held = market.held;
  const priceValue = toNumber(price);
  const quantity = toNumber(count);
  const proceeds = quantity > 0 && priceValue > 0 ? quantity * priceValue : 0;
  const xlmNeeded = cost.feeXlm + cost.reserveXlm + cost.offerLockXlm;
  const xlmOk = market.availableXlm >= xlmNeeded;

  // A listing priced at the best bid fills straight away; above it the seller
  // waits for a buyer, so the default starts from the live bid.
  useEffect(() => {
    if (price !== '') return;
    if (market.bestBid > 0) setPrice(plainPrice(market.bestBid));
    else if (market.floor > 0) setPrice(plainPrice(market.floor));
    else if (collection.mint_price > 0) setPrice(plainPrice(collection.mint_price));
  }, [market.bestBid, market.floor, collection.mint_price, price]);

  const list = async () => {
    if (!wallet) {
      connect();
      return;
    }
    if (!(quantity > 0)) return;
    if (quantity > held + 1e-9) {
      toast({
        title: `You hold ${fmtAmount(held, 2)} ${held === 1 ? 'edition' : 'editions'}`,
        variant: 'destructive',
      });
      return;
    }
    if (!(priceValue >= MIN_MINT_PRICE)) {
      toast({
        title: 'That price is too small for the network',
        description: `The lowest priceable amount is ${plainPrice(MIN_MINT_PRICE)} ${label}.`,
        variant: 'destructive',
      });
      return;
    }
    if (!xlmOk) {
      toast({
        title: 'Not enough XLM to keep this listing open',
        description: `A listing locks ${cost.offerLockXlm} XLM${cost.reserveXlm ? ' plus a trustline reserve' : ''} while it is open.`,
        variant: 'destructive',
      });
      return;
    }

    setBusy(true);
    try {
      await listEditions({ address: wallet.address, collection, quantity, price: priceValue });
      toast({
        title: `${fmtAmount(quantity, 2)} ${quantity === 1 ? 'edition' : 'editions'} listed`,
        description: `$${collection.symbol} at ${fmtAmount(priceValue, 6)} ${label} each — anyone can buy them on the DEX.`,
      });
      onDone?.();
    } catch (e) {
      toast({
        title: 'That listing did not go through',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (offer) => {
    if (!wallet) {
      connect();
      return;
    }
    setBusy(true);
    try {
      await cancelListing({ address: wallet.address, collection, offer });
      toast({ title: 'Listing cancelled', description: 'The editions are back in your wallet.' });
      onDone?.();
    } catch (e) {
      toast({
        title: 'That listing could not be cancelled',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/50">Your editions</span>
        <span className="font-bold">{fmtAmount(held, 2)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Editions</label>
          <input
            type="number"
            min="1"
            step="1"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            disabled={busy || held === 0}
            className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 disabled:opacity-40"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1.5 block">Price each ({label})</label>
          <input
            type="text"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={market.floor > 0 ? plainPrice(market.floor) : '0.5'}
            disabled={busy || held === 0}
            className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 font-mono disabled:opacity-40"
          />
        </div>
      </div>

      <div className="bg-black/30 rounded-xl p-3 space-y-1.5 border border-white/5">
        <Row label="Best bid right now" value={market.bestBid > 0 ? `${fmtAmount(market.bestBid, 6)} ${label}` : '—'} />
        <Row label="Cheapest listing" value={market.floor > 0 ? `${fmtAmount(market.floor, 6)} ${label}` : '—'} />
        <Row
          label="You receive when sold"
          value={`${proceeds > 0 ? fmtAmount(proceeds, 6) : '—'} ${proceeds > 0 ? label : ''}`}
        />
        <Row label="Network fee" value={`~${cost.feeXlm.toFixed(7)} XLM`} />
        <Row label="Listing lock (returned later)" value={`${cost.offerLockXlm} XLM`} />
        {cost.reserveXlm > 0 && (
          <Row label="USDC trustline reserve (locked)" value={`${cost.reserveXlm} XLM`} />
        )}
      </div>

      {held === 0 ? (
        <p className="text-[10px] text-white/30">
          This wallet holds no editions of ${collection.symbol} yet. Buy or mint one first, then it
          can be listed here.
        </p>
      ) : (
        <p className="text-[10px] text-white/30">
          Priced at the best bid the offer fills straight away; list higher and it waits for a buyer.
          The editions stay yours until it fills, and the network pays you directly.
        </p>
      )}

      <button
        onClick={list}
        disabled={busy || held === 0 || quantity <= 0 || !(priceValue >= MIN_MINT_PRICE)}
        className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
      >
        {busy ? 'Working…' : !wallet ? 'Connect Wallet to Sell' : 'List for Sale'}
      </button>

      {market.myListings.length > 0 && (
        <div className="bg-black/30 rounded-xl p-3 space-y-2 border border-white/5">
          <p className="text-xs font-bold">Your open listings</p>
          {market.myListings.map((o) => (
            <div key={o.offerId} className="flex items-center justify-between text-[11px]">
              <span className="text-white/70">
                {fmtAmount(o.amount, 2)} @ {fmtAmount(o.price, 6)} {label}
              </span>
              <button
                onClick={() => cancel(o)}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg bg-white/5 text-white/70 font-bold disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}