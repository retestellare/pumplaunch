import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import {
  loadAccount,
  parseBalances,
  buildBuyTransaction,
  buildSellTransaction,
  signAndSubmit,
  estimateTradeCost,
} from '@/lib/stellar';

export default function TradingPanel({ token, onTrade }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [xlmBalance, setXlmBalance] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(0);

  const price = token.price || 0.000001;
  const isOnChain = !!(token.issuer && token.asset_code);

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
  const estOut = side === 'buy'
    ? (parseFloat(amount) || 0) / price
    : (parseFloat(amount) || 0) * price;

  const startConfirm = () => {
    if (!wallet) {
      toast({ title: 'Connect your wallet first', variant: 'destructive' });
      return;
    }
    if (!isOnChain) {
      toast({ title: 'This token is not on-chain yet', variant: 'destructive' });
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
      if (side === 'buy') {
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
      await signAndSubmit(tx);
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
      toast({ title: `${side === 'buy' ? 'Bought' : 'Sold'} on mainnet!` });
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

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
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
      {amount && (
        <div className="text-xs text-white/40">
          ≈ {estOut.toFixed(2)} {side === 'buy' ? token.symbol : 'XLM'}
        </div>
      )}

      {confirm && (
        <div className="bg-black/40 rounded-xl p-3 space-y-1.5 border border-white/5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">You {side === 'buy' ? 'send' : 'sell'}</span>
            <span className="font-medium">{confirm.amount} {side === 'buy' ? 'XLM' : token.symbol}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40">You receive (est)</span>
            <span className="font-medium">{confirm.estOut.toFixed(2)} {side === 'buy' ? token.symbol : 'XLM'}</span>
          </div>
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
            {busy ? 'Processing…' : 'Confirm on mainnet'}
          </button>
        </div>
      ) : (
        <button
          onClick={startConfirm}
          className={`w-full py-3.5 rounded-xl font-bold text-sm ${
            side === 'buy' ? 'bg-[#00ff88] text-black' : 'bg-[#ff3b5c] text-black'
          }`}
        >
          {wallet ? `${side === 'buy' ? 'Buy' : 'Sell'} $${token.symbol}` : 'Connect Wallet'}
        </button>
      )}
    </div>
  );
}