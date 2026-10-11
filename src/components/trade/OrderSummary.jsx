import { ROUTE_LABEL } from '@/lib/market';
import { fmtAmount } from '@/lib/tradeQuote';

// The order summary shown once a trade is ready to confirm: what it sends, what
// it expects back, the price it is expected to fill at, and what Stellar charges.
export default function OrderSummary({ side, mode, token, quote, triggerPrice, confirm, fill, route, cost }) {
  const receivedUnit = side === 'buy' ? token.symbol : quote.label;
  return (
    <div className="bg-black/40 rounded-xl p-3 space-y-1.5 border border-white/5">
      {mode === 'limit' && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Trigger Price</span>
          <span className="font-medium">
            {triggerPrice.toFixed(8)} {quote.label}
          </span>
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
          {fmtAmount(confirm.estOut)} {receivedUnit}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{mode === 'limit' ? 'Order price' : 'Expected fill'}</span>
        <span className="font-medium">
          {fill.fillPrice > 0 ? fmtAmount(fill.fillPrice, 8) : '—'} {quote.label} per {token.symbol}
          {route ? ` · ${ROUTE_LABEL[route]}` : ''}
        </span>
      </div>
      {mode === 'market' && fill.impact >= 0.1 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Spot price</span>
          <span className="text-white/50">
            {fill.spot.toFixed(8)} {quote.label} · {fill.impact.toFixed(2)}% impact
          </span>
        </div>
      )}
      {mode === 'market' && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">Minimum received</span>
          <span className="font-medium">
            {fmtAmount(confirm.estOut * 0.9)} {receivedUnit}
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
  );
}