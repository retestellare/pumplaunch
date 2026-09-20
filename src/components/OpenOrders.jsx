import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import {
  fetchOpenOrders,
  buildCancelOfferTransaction,
  signAndSubmit,
  loadAccount,
} from '@/lib/stellar';

export default function OpenOrders({ token, refreshKey }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(null);

  const load = async () => {
    if (!wallet?.address || !token?.issuer) {
      setLoading(false);
      return;
    }
    try {
      const ords = await fetchOpenOrders(wallet.address, token.asset_code, token.issuer);
      setOrders(ords);
    } catch {
      /* ignore */
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
  }, [wallet?.address, token?.id, refreshKey]);

  const cancel = async (order) => {
    setCancelling(order.offerId);
    try {
      const account = await loadAccount(wallet.address);
      if (!account) {
        toast({ title: 'Account not found', variant: 'destructive' });
        return;
      }
      const tx = buildCancelOfferTransaction({
        sourceAccount: account,
        side: order.side,
        assetCode: token.asset_code,
        issuer: token.issuer,
        offerId: order.offerId,
        price: order.price,
      });
      await signAndSubmit(tx);
      toast({ title: 'Order cancelled' });
      try {
        await base44.entities.Activity.create({
          wallet_address: wallet.address,
          type: 'order_cancelled',
          token_symbol: token.symbol,
          token_id: token.id,
          price: order.price,
          details: `Cancelled ${order.side} order for $${token.symbol}`,
        });
      } catch {
        /* ignore */
      }
      await load();
    } catch (e) {
      toast({ title: 'Cancel failed', description: e.message || String(e), variant: 'destructive' });
    }
    setCancelling(null);
  };

  if (!wallet?.address || !token?.issuer) return null;
  if (loading) return null;

  return (
    <div className="bg-[#141518] rounded-2xl p-4">
      <h3 className="font-bold mb-3">Open Orders</h3>
      {orders.length === 0 ? (
        <p className="text-sm text-white/30">No open orders.</p>
      ) : (
        <div className="space-y-2">
          {orders.map((o) => (
            <div key={o.offerId} className="flex items-center justify-between text-sm gap-2">
              <span className={`font-medium ${o.side === 'buy' ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
                {o.side === 'buy' ? 'Buy' : 'Sell'}
              </span>
              <span className="text-white/60 flex-1 text-right">{o.amount.toFixed(1)} ${token.symbol}</span>
              <span className="text-white/40 text-xs">@ {o.price.toFixed(8)}</span>
              <button
                onClick={() => cancel(o)}
                disabled={cancelling === o.offerId}
                className="text-xs text-[#ff3b5c] font-medium disabled:opacity-50 shrink-0"
              >
                {cancelling === o.offerId ? '…' : 'Cancel'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}