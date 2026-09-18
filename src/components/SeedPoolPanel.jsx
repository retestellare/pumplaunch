import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import {
  loadAccount,
  buildPoolSetupTransaction,
  signAndSubmit,
  BASE_PRICE,
} from '@/lib/stellar';

export default function SeedPoolPanel({ token, onSeeded }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [xlmAmount, setXlmAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [tokenBalance, setTokenBalance] = useState(0);

  useEffect(() => {
    if (!wallet?.address) return;
    let active = true;
    (async () => {
      try {
        const account = await loadAccount(wallet.address);
        if (!active || !account) return;
        const tl = (account.balances || []).find(
          (b) => b.asset_code === token.asset_code && b.asset_issuer === token.issuer
        );
        setTokenBalance(tl ? parseFloat(tl.balance) : 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet?.address, token?.id]);

  const xlm = parseFloat(xlmAmount) || 0;
  const tokenAmount = xlm / BASE_PRICE;
  const canSeed = wallet && xlm >= 10 && tokenAmount <= tokenBalance;

  const seed = async () => {
    if (!canSeed) return;
    setBusy(true);
    try {
      const account = await loadAccount(wallet.address);
      if (!account) {
        toast({ title: 'Account not found', variant: 'destructive' });
        setBusy(false);
        return;
      }
      const tx = buildPoolSetupTransaction({
        sourceAccount: account,
        assetCode: token.asset_code,
        issuer: token.issuer,
        xlmAmount: xlm,
        tokenAmount,
      });
      await signAndSubmit(tx);
      toast({ title: 'Liquidity pool seeded!' });
      setXlmAmount('');
      onSeeded?.();
    } catch (e) {
      toast({ title: 'Pool seeding failed', description: e.message || String(e), variant: 'destructive' });
    }
    setBusy(false);
  };

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="font-bold text-sm">⚠ No liquidity pool yet</h3>
        <p className="text-xs text-white/40 mt-1">
          This token has no pool. Deposit XLM + {token.symbol} to create one and enable trading.
        </p>
      </div>
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">XLM to deposit (min 10)</label>
        <input
          type="number"
          value={xlmAmount}
          onChange={(e) => setXlmAmount(e.target.value)}
          placeholder="e.g. 50"
          className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
        />
      </div>
      {xlm > 0 && (
        <div className="text-xs text-white/40 space-y-1">
          <div className="flex justify-between">
            <span>You deposit</span>
            <span className="text-white/70">{xlm} XLM</span>
          </div>
          <div className="flex justify-between">
            <span>+ tokens</span>
            <span className="text-white/70">{tokenAmount.toLocaleString()} {token.symbol}</span>
          </div>
          <div className="flex justify-between">
            <span>Your balance</span>
            <span className="text-white/70">{tokenBalance.toLocaleString()} {token.symbol}</span>
          </div>
        </div>
      )}
      {xlm > 0 && tokenAmount > tokenBalance && (
        <p className="text-xs text-[#ff3b5c]">Not enough {token.symbol} balance for this deposit.</p>
      )}
      <button
        onClick={seed}
        disabled={!canSeed || busy}
        className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
      >
        {busy ? 'Seeding pool…' : 'Seed Liquidity Pool'}
      </button>
    </div>
  );
}