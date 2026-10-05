import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import {
  loadAccount,
  parseBalances,
  buildBuyTransaction,
  buildSellTransaction,
  buildLimitBuyTransaction,
  buildLimitSellTransaction,
  signAndSubmit,
  estimateTradeCost,
} from '@/lib/stellar';
import TriggerPriceModal from '@/components/TriggerPriceModal';
import PayWithSelector from '@/components/PayWithSelector';
import { ROUTE_LABEL } from '@/lib/market';
import { QUOTES, tokenPools, toXlm, USDC_CODE, USDC_ISSUER } from '@/lib/pools';
import ShareButton from '@/components/ShareButton';
import { tradeShare } from '@/lib/share';

const LIMIT_PRESETS = [5, 10, 20];

export default function TradingPanel({ token, market, xlmPerUsdc = 0, onTrade }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [side, setSide] = useState('buy');
  const [mode, setMode] = useState('market');
  const [payWith, setPayWith] = useState('xlm');
  const [chosenQuote, setChosenQuote] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [xlmBalance, setXlmBalance] = useState(0);
  const [usdcBalance, setUsdcBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [usdcTrustline, setUsdcTrustline] = useState(false);
  const [triggerPrice, setTriggerPrice] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [lastTrade, setLastTrade] = useState(null);

  const isOnChain = !!(token.issuer && token.asset_code);
  const isAutoPool = !!token.is_auto_pool;
  const availableQuotes = tokenPools(token);
  const quotesKey = availableQuotes.join(',');
  const quote = QUOTES[payWith] || QUOTES.xlm;

  // Follow the token's own markets.
  useEffect(() => {
    const list = quotesKey.split(',');
    if (!list.includes(payWith)) setPayWith(list[0]);
  }, [quotesKey, payWith]);

  // Until the trader picks a side, follow whichever market is the best way in.
  useEffect(() => {
    if (chosenQuote) return;
    if (market?.buyQuote && quotesKey.split(',').includes(market.buyQuote)) {
      setPayWith(market.buyQuote);
    }
  }, [market?.buyQuote, chosenQuote, quotesKey]);

  const pickQuote = (key) => {
    setChosenQuote(true);
    setPayWith(key);
  };

  // Every figure shown is in the chosen market's own unit: a trade paid in USDC
  // is sized in USDC, even though the headline price is normalised to XLM.
  const quoteMarket = market?.markets?.[payWith] || null;
  const routePrice = side === 'buy' ? quoteMarket?.buyPriceQuote || 0 : quoteMarket?.sellPriceQuote || 0;
  const route = side === 'buy' ? quoteMarket?.buyRoute : quoteMarket?.sellRoute;
  const price = routePrice;
  const tradable = price > 0;

  useEffect(() => {
    if (mode === 'limit' && triggerPrice === 0 && price > 0) {
      setTriggerPrice(price);
    }
  }, [mode, price]);

  const applyAccount = (account) => {
    if (!account) return;
    const { xlm } = parseBalances(account);
    setXlmBalance(xlm);
    const usd = (account.balances || []).find(
      (b) => b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER
    );
    setUsdcBalance(usd ? parseFloat(usd.balance) : 0);
    setUsdcTrustline(!!usd);
    if (isOnChain) {
      const tl = (account.balances || []).find(
        (b) => b.asset_code === token.asset_code && b.asset_issuer === token.issuer
      );
      setTokenBalance(tl ? parseFloat(tl.balance) : 0);
    }
  };

  const refreshBalances = async () => {
    if (!wallet?.address) return;
    applyAccount(await loadAccount(wallet.address));
  };

  useEffect(() => {
    setXlmBalance(0);
    setUsdcBalance(0);
    setTokenBalance(0);
    if (!wallet?.address) return;
    let active = true;
    (async () => {
      try {
        const account = await loadAccount(wallet.address);
        if (!active) return;
        applyAccount(account);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet?.address, token?.id]);

  const payBalance = payWith === 'usdc' ? usdcBalance : xlmBalance;
  const balance = side === 'buy' ? payBalance : tokenBalance;
  const needsUsdcTrustline = payWith === 'usdc' && !usdcTrustline;
  const effectivePrice = mode === 'limit' ? triggerPrice : price;
  const estOut = effectivePrice > 0 ? (parseFloat(amount) || 0) / effectivePrice : 0;

  const applyPreset = (pct) => {
    setTriggerPrice(side === 'buy' ? price * (1 - pct / 100) : price * (1 + pct / 100));
  };

  const startConfirm = () => {
    if (!wallet) {
      toast({ title: 'Connect your wallet first', variant: 'destructive' });
      return;
    }
    if (!isOnChain) {
      toast({ title: 'This token is not on-chain yet', variant: 'destructive' });
      return;
    }
    if (!tradable) {
      toast({
        title: `No ${quote.label} market to trade against yet`,
        description: 'This token has no pool and no open offers in that currency.',
        variant: 'destructive',
      });
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > balance) {
      toast({
        title: `Insufficient ${side === 'buy' ? quote.label : token.symbol}`,
        variant: 'destructive',
      });
      return;
    }
    if (mode === 'limit' && (!triggerPrice || triggerPrice <= 0)) {
      toast({ title: 'Set a trigger price first', variant: 'destructive' });
      return;
    }
    setConfirm({ amount: amt, estOut });
    setLastTrade(null);
  };

  const execute = async () => {
    setBusy(true);
    try {
      const account = await loadAccount(wallet.address);
      if (!account) {
        toast({ title: 'Account not found', variant: 'destructive' });
        setBusy(false);
        return;
      }

      const args = {
        sourceAccount: account,
        assetCode: token.asset_code,
        issuer: token.issuer,
        quote: payWith,
      };
      let tx;
      if (mode === 'limit') {
        tx = side === 'buy'
          ? buildLimitBuyTransaction({ ...args, amount: confirm.amount, triggerPrice })
          : buildLimitSellTransaction({ ...args, tokenAmount: confirm.amount, triggerPrice });
      } else {
        tx = side === 'buy'
          ? buildBuyTransaction({ ...args, amount: confirm.amount, minTokensOut: confirm.estOut * 0.9 })
          : buildSellTransaction({ ...args, tokenAmount: confirm.amount, minOut: confirm.estOut * 0.9 });
      }
      await signAndSubmit(tx);

      if (mode === 'market') {
        await base44.entities.Trade.create({
          token_id: token.id,
          token_symbol: token.symbol,
          token_name: token.name,
          type: side,
          // Stored in XLM so a USDC trade still counts in one unit everywhere.
          amount_xlm: toXlm(side === 'buy' ? confirm.amount : confirm.estOut, payWith, xlmPerUsdc),
          tokens: side === 'buy' ? confirm.estOut : confirm.amount,
          price: token.price,
          user_address: wallet.address,
        });
      } else {
        try {
          await base44.entities.Activity.create({
            wallet_address: wallet.address,
            type: 'order_placed',
            token_symbol: token.symbol,
            token_id: token.id,
            amount_xlm: side === 'buy' ? toXlm(confirm.amount, payWith, xlmPerUsdc) : 0,
            tokens: side === 'sell' ? confirm.amount : 0,
            price: triggerPrice,
            details: `Limit ${side} order for $${token.symbol} @ ${triggerPrice.toFixed(8)} ${quote.label}`,
          });
        } catch {
          /* ignore */
        }
      }
      toast({ title: mode === 'limit' ? 'Limit order placed!' : `${side === 'buy' ? 'Bought' : 'Sold'} on mainnet!` });
      if (mode === 'market') {
        setLastTrade({ side, quoteLabel: quote.label, amount: confirm.amount, received: confirm.estOut });
      }
      setConfirm(null);
      setAmount('');
      await refreshBalances();
      onTrade?.();
    } catch (e) {
      toast({ title: 'Trade failed', description: e.message || String(e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const cost = estimateTradeCost(side, { needsUsdcTrustline });
  const delta = price > 0 && triggerPrice > 0 ? ((triggerPrice - price) / price) * 100 : 0;

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      {!isAutoPool && (
        <div className="flex gap-2 p-1 bg-black/30 rounded-xl">
          <button
            onClick={() => setMode('market')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
              mode === 'market' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => setMode('limit')}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
              mode === 'limit' ? 'bg-white/10 text-white' : 'text-white/40'
            }`}
          >
            Limit
          </button>
        </div>
      )}

      <div className="flex gap-2 p-1 bg-black/30 rounded-xl">
        <button
          onClick={() => setSide('buy')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
            side === 'buy' ? 'bg-[#00ff88] text-black' : 'text-white/50'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
            side === 'sell' ? 'bg-[#ff3b5c] text-black' : 'text-white/50'
          }`}
        >
          Sell
        </button>
      </div>

      <PayWithSelector
        quotes={availableQuotes}
        value={payWith}
        onChange={pickQuote}
        label={side === 'buy' ? 'Pay with' : 'Receive'}
      />

      {mode === 'limit' && (
        <div>
          <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
            <span>Trigger Price ({quote.label})</span>
            <button onClick={() => setShowModal(true)} className="text-[#00ff88] font-medium">
              Set Custom
            </button>
          </div>
          <div className="bg-black/30 border border-white/5 rounded-xl px-3 py-2.5 flex items-center justify-between">
            <span className="text-lg font-semibold">{triggerPrice > 0 ? triggerPrice.toFixed(8) : '—'}</span>
            {triggerPrice > 0 && (
              <span className={`text-xs font-medium ${delta >= 0 ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
                {delta >= 0 ? '+' : ''}{delta.toFixed(2)}%
              </span>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            {LIMIT_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className="flex-1 py-1.5 rounded-lg bg-white/5 text-xs text-white/60 font-medium hover:bg-white/10"
              >
                {side === 'buy' ? '−' : '+'}{p}%
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
          <span>{side === 'buy' ? `Amount (${quote.label})` : `Amount (${token.symbol})`}</span>
          <span>
            Bal: {balance.toFixed(2)} {side === 'buy' ? quote.label : token.symbol}
          </span>
        </div>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 text-lg font-semibold outline-none focus:border-[#00ff88]/40"
        />
        <div className="flex gap-2 mt-2">
          {[25, 50, 100].map((p) => (
            <button
              key={p}
              onClick={() => setAmount(String((balance * (p / 100)).toFixed(2)))}
              className="flex-1 py-1.5 rounded-lg bg-white/5 text-xs text-white/60 font-medium hover:bg-white/10"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {amount && tradable && (
        <div className="text-xs text-white/40">
          ≈ {estOut.toFixed(2)} {side === 'buy' ? token.symbol : quote.label} · {effectivePrice.toFixed(8)}{' '}
          {quote.label}
          {route ? ` via ${ROUTE_LABEL[route]}` : ''}
        </div>
      )}

      {needsUsdcTrustline && tradable && (
        <div className="bg-[#3b82f6]/5 border border-[#3b82f6]/20 rounded-xl p-3">
          <p className="text-xs text-white/60">
            Your wallet has no USDC trustline yet — it is added in the same transaction, so one approval covers both.
            It reserves 0.5 XLM.
          </p>
        </div>
      )}

      {confirm && (
        <div className="bg-black/40 rounded-xl p-3 space-y-1.5 border border-white/5">
          {mode === 'limit' && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Trigger Price</span>
              <span className="font-medium">{triggerPrice.toFixed(8)} {quote.label}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Market</span>
            <span className="font-medium">{quote.label}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">You {side === 'buy' ? 'send' : 'sell'}</span>
            <span className="font-medium">
              {confirm.amount} {side === 'buy' ? quote.label : token.symbol}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">{mode === 'limit' ? 'Order size' : 'You receive (est)'}</span>
            <span className="font-medium">
              {confirm.estOut.toFixed(2)} {side === 'buy' ? token.symbol : quote.label}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Price used</span>
            <span className="font-medium">
              {effectivePrice.toFixed(8)} {quote.label}{route ? ` · ${ROUTE_LABEL[route]}` : ''}
            </span>
          </div>
          {mode === 'market' && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Minimum received</span>
              <span className="font-medium">
                {(confirm.estOut * 0.9).toFixed(2)} {side === 'buy' ? token.symbol : quote.label}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Network fee</span>
            <span className="text-white/60">~{cost.feeXlm.toFixed(5)} XLM</span>
          </div>
          {cost.reserveXlm > 0 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Reserve (refundable)</span>
              <span className="text-white/60">~{cost.reserveXlm.toFixed(1)} XLM</span>
            </div>
          )}
        </div>
      )}

      {market && !tradable && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-3">
          <p className="text-xs text-white/50">
            No {quote.label} market to trade against yet — this token has no pool and no open offers in that currency.
          </p>
        </div>
      )}

      {confirm ? (
        <div className="flex gap-2">
          <button
            onClick={() => setConfirm(null)}
            disabled={busy}
            className="flex-1 py-3.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={execute}
            disabled={busy}
            className={`flex-1 py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 ${
              side === 'buy' ? 'bg-[#00ff88] text-black' : 'bg-[#ff3b5c] text-black'
            }`}
          >
            {busy ? 'Processing…' : mode === 'limit' ? 'Place Limit Order' : 'Confirm on mainnet'}
          </button>
        </div>
      ) : (
        <button
          onClick={startConfirm}
          disabled={!!market && !tradable}
          className={`w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 ${
            side === 'buy' ? 'bg-[#00ff88] text-black' : 'bg-[#ff3b5c] text-black'
          }`}
        >
          {!wallet
            ? 'Connect Wallet'
            : market && !tradable
            ? `No ${quote.label} liquidity yet`
            : `${mode === 'limit' ? 'Limit ' : ''}${side === 'buy' ? 'Buy' : 'Sell'} $${token.symbol}`}
        </button>
      )}

      {lastTrade && (
        <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-3 space-y-2">
          <p className="text-xs text-white/60">Trade confirmed on mainnet — let people know.</p>
          <ShareButton
            payload={tradeShare({ token, ...lastTrade })}
            label={`Share my ${lastTrade.side === 'buy' ? 'buy' : 'sell'} of $${token.symbol}`}
          />
        </div>
      )}

      {showModal && (
        <TriggerPriceModal
          marketPrice={price}
          side={side}
          symbol={token.symbol}
          initialPrice={triggerPrice || price}
          onClose={() => setShowModal(false)}
          onSave={(p) => {
            setTriggerPrice(p);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}