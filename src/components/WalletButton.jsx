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
        className="h-[34px] px-3 rounded-[10px] bg-[#00F59B] text-[#04100B] text-[11px] font-extrabold tracking-[.04em] uppercase select-none transition duration-200 hover:shadow-[0_0_14px_rgba(0,245,155,.7)] active:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B] disabled:opacity-50"
      >
        {connecting ? 'Connecting…' : 'Connect'}
      </button>
    );
  }

  const short = `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}`;
  return (
    <button
      onClick={disconnect}
      className="h-[34px] flex items-center gap-2 px-3 rounded-[10px] bg-[#16211E] border border-[#00F59B]/25 select-none transition duration-200 hover:shadow-[0_0_10px_rgba(0,245,155,.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
    >
      <span className="text-[11px] font-extrabold text-[#00F59B]">
        {balances ? balances.xlm.toFixed(2) : '…'} XLM
      </span>
      <span className="text-[11px] font-extrabold text-[#4d9eff]">
        {balances ? balances.usdc.toFixed(2) : '…'} USDC
      </span>
      <span className="text-[10px] font-mono text-[#F2F7F4]/40">{short}</span>
    </button>
  );
}