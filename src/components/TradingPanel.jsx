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
  buildPoolBuyTransaction,
  buildPoolSellTransaction,
  signAndSubmit,
  estimateTradeCost,
} from '@/lib/stellar';
import TriggerPriceModal from '@/components/TriggerPriceModal';
import { ROUTE_LABEL } from '@/lib/market';

const LIMIT_PRESETS = [5, 10, 20];

export default function TradingPanel({ token, market, onTrade }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [side, setSide] = useState('buy');
  const [mode, setMode] = useState('market');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [xlmBalance, setXlmBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);
  const [triggerPrice, setTriggerPrice] = useState(0);
  const [showModal, setShowModal] = useState(false);

  const isOnChain = !!(token.issuer && token.asset_code);
  const isAutoPool = !!token.is_auto_pool;

  // Best route for this direction: the pool and the book compared, never a
  // quote invented from a stored or fallback price.
  const routePrice = side === 'buy' ? market?.buyPrice || 0 : market?.sellPrice || 0;
  const route = side === 'buy' ? market?.buyRoute : market?.sellRoute;
  const price = routePrice;
  const tradable = price > 0;

  useEffect(() => {
    if (mode === 'limit' && triggerPrice === 0 && price > 0) {
      setTriggerPrice(price);
    }
  }, [mode, price]);

  const refreshBalances = async () => {
    if (!wallet?.address) return;
    const account = await loadAccount(wallet.address);
    if (!account) return;
    const { xlm } = parseBalances(account);
    setXlmBalance(xlm);
    if (isOnChain) {
      const tl = (account.balances || []).find(
        (b) => b.asset_code === token.asset_code && b.asset_issuer === token.issuer
      );
      setTokenBalance(tl ? parseFloat(tl.balance) : 0);
    }
  };

  useEffect(() => {
    setXlmBalance(0);
    setTokenBalance(0);
    if (!wallet?.address) return;
    let active = true;
    (async () => {
      try {
        const account = await loadAccount(wallet.address);
        if (!active || !account) return;
        const { xlm } = parseBalances(account);
        setXlmBalance(xlm);
        if (isOnChain) {
          const tl = (account.balances || []).find(
            (b) => b.asset_code === token.asset_code && b.asset_issuer === token.issuer
          );
          setTokenBalance(tl ? parseFloat(tl.balance) : 0);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet?.address, token?.id]);

  const balance = side === 'buy' ? xlmBalance : tokenBalance;
  const effectivePrice = mode === 'limit' ? triggerPrice : price;
  const estOut = effectivePrice > 0
    ? (parseFloat(amount) || 0) / effectivePrice
    : 0;

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
        title: 'No liquidity to trade against yet',
        description: 'This token has no pool and no open offers.',
        variant: 'destructive',
      });
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    if (amt > balance) {
      toast({
        title: `Insufficient ${side === 'buy' ? 'XLM' : token.symbol}`,
        variant: 'destructive',
      });
      return;
    }
    if (mode === 'limit' && (!triggerPrice || triggerPrice <= 0)) {
      toast({ title: 'Set a trigger price first', variant: 'destructive' });
      return;
    }
    setConfirm({ amount: amt, estOut });
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
      let tx;
      if (mode === 'limit') {
        if (side === 'buy') {
          tx = buildLimitBuyTransaction({
            sourceAccount: account,
            assetCode: token.asset_code,
            issuer: token.issuer,
            xlmAmount: confirm.amount,
            triggerPrice,
          });
        } else {
          tx = buildLimitSellTransaction({
            sourceAccount: account,
            assetCode: token.asset_code,
            issuer: token.issuer,
            tokenAmount: confirm.amount,
            triggerPrice,
          });
        }
      } else {
        if (isAutoPool) {
          if (side === 'buy') {
            tx = buildPoolBuyTransaction({
              sourceAccount: account,
              assetCode: token.asset_code,
              issuer: token.issuer,
              xlmAmount: confirm.amount,
              minTokensOut: confirm.estOut * 0.9,
            });
          } else {
            tx = buildPoolSellTransaction({
              sourceAccount: account,
              assetCode: token.asset_code,
              issuer: token.issuer,
              tokenAmount: confirm.amount,
              minXlmOut: confirm.estOut * 0.9,
            });
          }
        } else if (side === 'buy') {
          tx = buildBuyTransaction({
            sourceAccount: account,
            assetCode: token.asset_code,
            issuer: token.issuer,
            xlmAmount: confirm.amount,
            minTokensOut: confirm.estOut * 0.9,
          });
        } else {
          tx = buildSellTransaction({
            sourceAccount: account,
            assetCode: token.asset_code,
            issuer: token.issuer,
            tokenAmount: confirm.amount,
            minXlmOut: confirm.estOut * 0.9,
          });
        }
      }
      await signAndSubmit(tx);
      if (mode === 'market') {
        await base44.entities.Trade.create({
          token_id: token.id,
          token_symbol: token.symbol,
          token_name: token.name,
          type: side,
          amount_xlm: side === 'buy' ? confirm.amount : confirm.estOut,
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
            amount_xlm: side === 'buy' ? confirm.amount : 0,
            tokens: side === 'sell' ? confirm.amount : 0,
            price: triggerPrice,
            details: `Limit ${side} order for $${token.symbol} @ ${triggerPrice.toFixed(8)} XLM`,
          });
        } catch {
          /* ignore */
        }
      }
      toast({ title: mode === 'limit' ? 'Limit order placed!' : `${side === 'buy' ? 'Bought' : 'Sold'} on mainnet!` });
      setConfirm(null);
      setAmount('');
      await refreshBalances();
      onTrade?.();
    } catch (e) {
      toast({ title: 'Trade failed', description: e.message || String(e), variant: 'destructive' });
    }
    setBusy(false);
  };

  const cost = estimateTradeCost(side);
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

      {mode === 'limit' && (
        <div>
          <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
            <span>Trigger Price (XLM)</span>
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
          <span>{side === 'buy' ? 'Amount (XLM)' : `Amount (${token.symbol})`}</span>
          <span>Bal: {balance.toFixed(2)}</span>
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
          ≈ {estOut.toFixed(2)} {side === 'buy' ? token.symbol : 'XLM'} · {effectivePrice.toFixed(8)} XLM
          {route ? ` via ${ROUTE_LABEL[route]}` : ''}
        </div>
      )}

      {confirm && (
        <div className="bg-black/40 rounded-xl p-3 space-y-1.5 border border-white/5">
          {mode === 'limit' && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Trigger Price</span>
              <span className="font-medium">{triggerPrice.toFixed(8)} XLM</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">You {side === 'buy' ? 'send' : 'sell'}</span>
            <span className="font-medium">{confirm.amount} {side === 'buy' ? 'XLM' : token.symbol}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">{mode === 'limit' ? 'Order size' : 'You receive (est)'}</span>
            <span className="font-medium">{confirm.estOut.toFixed(2)} {side === 'buy' ? token.symbol : 'XLM'}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">Price used</span>
            <span className="font-medium">
              {effectivePrice.toFixed(8)} XLM{route ? ` · ${ROUTE_LABEL[route]}` : ''}
            </span>
          </div>
          {mode === 'market' && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Minimum received</span>
              <span className="font-medium">
                {(confirm.estOut * 0.9).toFixed(2)} {side === 'buy' ? token.symbol : 'XLM'}
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
            No liquidity to trade against yet — this token has no pool and no open offers.
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
            {busy ? 'Processing…' : mode === 'limit' ? 'Place Limit Order' : isAutoPool ? 'Swap via Liquidity Pool' : 'Confirm on mainnet'}
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
            ? 'No liquidity yet'
            : `${mode === 'limit' ? 'Limit ' : ''}${side === 'buy' ? 'Buy' : 'Sell'} $${token.symbol}`}
        </button>
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