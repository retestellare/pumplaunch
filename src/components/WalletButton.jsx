import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/wallet';
import { loadAccount, parseBalances } from '@/lib/stellar';
import { USDC_CODE, USDC_ISSUER } from '@/lib/pools';

export default function WalletButton() {
  const { wallet, connect, disconnect, connecting } = useWallet();
  const [balances, setBalances] = useState(null);

  useEffect(() => {
    if (!wallet?.address) {
      setBalances(null);
      return;
    }
    let active = true;
    const refresh = () =>
      loadAccount(wallet.address)
        .then((account) => {
          if (!active) return;
          if (!account) {
            setBalances({ xlm: 0, usdc: 0 });
            return;
          }
          const { xlm } = parseBalances(account);
          const tl = (account.balances || []).find(
            (b) => b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER
          );
          setBalances({ xlm, usdc: tl ? parseFloat(tl.balance) : 0 });
        })
        .catch(() => {
          if (active) setBalances({ xlm: 0, usdc: 0 });
        });
    refresh();
    const timer = setInterval(refresh, 20000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [wallet?.address]);

  if (!wallet) {
    return (
      <button
        onClick={connect}
        disabled={connecting}
        className="px-4 py-1.5 rounded-lg bg-[#00ff88] text-black text-sm font-bold disabled:opacity-50"
      >
        {connecting ? 'Connecting…' : 'Connect'}
      </button>
    );
  }

  const short = `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}`;
  return (
    <button
      onClick={disconnect}
      className="flex flex-col items-end leading-tight px-3 py-1 rounded-lg bg-white/5"
    >
      <span className="flex items-baseline gap-1.5">
        <span className="text-sm font-bold text-[#00ff88]">
          {balances ? balances.xlm.toFixed(2) : '…'} XLM
        </span>
        <span className="text-xs font-bold text-[#3b82f6]">
          {balances ? balances.usdc.toFixed(2) : '…'} USDC
        </span>
      </span>
      <span className="text-[10px] text-white/40">{short}</span>
    </button>
  );
}