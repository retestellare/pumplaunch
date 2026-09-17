import { useWallet } from '@/lib/wallet';

export default function WalletButton() {
  const { wallet, connect, disconnect } = useWallet();
  if (!wallet) {
    return (
      <button
        onClick={connect}
        className="px-4 py-1.5 rounded-lg bg-[#00ff88] text-black text-sm font-bold"
      >
        Connect
      </button>
    );
  }
  const short = `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}`;
  return (
    <button
      onClick={disconnect}
      className="flex flex-col items-end leading-tight px-3 py-1 rounded-lg bg-white/5 text-white/80"
    >
      <span className="text-sm font-bold text-[#00ff88]">{wallet.balance.toFixed(0)} XLM</span>
      <span className="text-[10px] text-white/40">{short}</span>
    </button>
  );
}