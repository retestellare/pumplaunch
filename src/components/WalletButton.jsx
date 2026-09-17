import { useState, useEffect } from 'react';
import { useWallet } from '@/lib/wallet';
import { fetchXlmBalance } from '@/lib/stellar';

export default function WalletButton() {
  const { wallet, connect, disconnect, connecting } = useWallet();
  const [xlm, setXlm] = useState(null);

  useEffect(() => {
    if (!wallet?.address) {
      setXlm(null);
      return;
    }
    let active = true;
    const refresh = () =>
      fetchXlmBalance(wallet.address)
        .then((b) => {
          if (active) setXlm(b);
        })
        .catch(() => {
          if (active) setXlm(0);
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
      className="flex flex-col items-end leading-tight px-3 py-1 rounded-lg bg-white/5 text-white/80"
    >
      <span className="text-sm font-bold text-[#00ff88]">{xlm != null ? xlm.toFixed(2) : '…'} XLM</span>
      <span className="text-[10px] text-white/40">{short}</span>
    </button>
  );
}