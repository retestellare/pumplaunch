import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';

export default function TradingPanel({ token, onTrade }) {
  const { wallet, updateBalance } = useWallet();
  const { toast } = useToast();
  const [side, setSide] = useState('buy');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  const price = token.price || 0.000001;
  const supply = token.supply || 1e9;

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!wallet) {
      toast({ title: 'Connect your wallet first', variant: 'destructive' });
      return;
    }
    if (!amt || amt <= 0) return;
    setBusy(true);
    try {
      const tokens = amt / price;
      const slip = Math.min((tokens / supply) * 0.8, 0.2);
      const newPrice = side === 'buy' ? price * (1 + slip) : price * (1 - slip);
      if (side === 'buy') {
        if (amt > wallet.balance) {
          toast({ title: 'Insufficient balance', variant: 'destructive' });
          setBusy(false);
          return;
        }
        updateBalance(wallet.balance - amt);
      } else {
        updateBalance(wallet.balance + amt);
      }
      await base44.entities.Trade.create({
        token_id: token.id,
        token_symbol: token.symbol,
        token_name: token.name,
        type: side,
        amount_xlm: amt,
        tokens,
        price: newPrice,
        user_address: wallet.address,
      });
      await base44.entities.Token.update(token.id, {
        price: newPrice,
        market_cap: newPrice * supply,
        holders: (token.holders || 1) + (side === 'buy' ? 1 : 0),
        volume_24h: (token.volume_24h || 0) + amt,
        change_24h: (token.change_24h || 0) + (side === 'buy' ? slip : -slip) * 100,
        is_graduated: newPrice * supply >= 69000,
      });
      toast({ title: `${side === 'buy' ? 'Bought' : 'Sold'} ${tokens.toFixed(2)} $${token.symbol}` });
      setAmount('');
      onTrade?.();
    } catch (e) {
      toast({ title: 'Trade failed', description: String(e.message || e), variant: 'destructive' });
    }
    setBusy(false);
  };

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
          <span>Amount (XLM)</span>
          <span>Bal: {wallet ? wallet.balance.toFixed(2) : '0'} XLM</span>
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
              onClick={() => setAmount(wallet ? String((wallet.balance * (p / 100)).toFixed(2)) : '0')}
              className="flex-1 py-1.5 rounded-lg bg-white/5 text-xs text-white/60 font-medium hover:bg-white/10"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>
      {amount && (
        <div className="text-xs text-white/40">
          ≈ {(parseFloat(amount) / price).toFixed(2)} ${token.symbol}
        </div>
      )}
      <button
        onClick={handleSubmit}
        disabled={busy}
        className={`w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 ${
          side === 'buy' ? 'bg-[#00ff88] text-black' : 'bg-[#ff3b5c] text-black'
        }`}
      >
        {busy ? 'Processing…' : wallet ? `${side === 'buy' ? 'Buy' : 'Sell'} $${token.symbol}` : 'Connect Wallet'}
      </button>
    </div>
  );
}