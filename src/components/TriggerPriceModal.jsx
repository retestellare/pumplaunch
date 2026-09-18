import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const PRESETS = [5, 10, 20];

export default function TriggerPriceModal({ marketPrice, side, symbol, initialPrice, onClose, onSave }) {
  const [price, setPrice] = useState(String(initialPrice || ''));

  useEffect(() => {
    setPrice(String(initialPrice || ''));
  }, [initialPrice]);

  const numPrice = parseFloat(price) || 0;
  const delta = marketPrice > 0 ? ((numPrice - marketPrice) / marketPrice) * 100 : 0;

  const applyPreset = (pct) => {
    const newPrice = side === 'buy'
      ? marketPrice * (1 - pct / 100)
      : marketPrice * (1 + pct / 100);
    setPrice(String(newPrice.toFixed(8)));
  };

  const save = () => {
    if (numPrice <= 0) return;
    onSave(numPrice);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center">
      <div className="w-full max-w-lg bg-[#0f1011] rounded-t-3xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg">Set Trigger Price</h3>
          <button onClick={onClose} className="text-white/40">
            <X size={20} />
          </button>
        </div>

        <div className="bg-black/30 border border-white/5 rounded-2xl p-4">
          <label className="text-xs text-white/40 block mb-2">TRIGGER PRICE</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00000000"
              className="flex-1 bg-transparent text-2xl font-bold outline-none min-w-0"
              autoFocus
            />
            <span className="bg-black/50 rounded-lg px-2.5 py-1 text-sm font-bold shrink-0">XLM</span>
          </div>
          {numPrice > 0 && marketPrice > 0 && (
            <div className={`text-sm font-medium mt-2 ${delta >= 0 ? 'text-[#00ff88]' : 'text-[#ff3b5c]'}`}>
              {delta >= 0 ? '+' : ''}{delta.toFixed(2)}% vs market
            </div>
          )}
        </div>

        <div className="text-xs text-white/40">
          Current price: 1 ${symbol} ≈ {marketPrice.toFixed(8)} XLM
        </div>

        <div>
          <label className="text-xs text-white/40 mb-2 block">Quick Presets</label>
          <div className="flex gap-2">
            <button
              onClick={() => setPrice(String(marketPrice.toFixed(8)))}
              className="flex-1 py-2.5 rounded-xl bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10"
            >
              Market
            </button>
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 text-sm font-medium text-white/70 hover:bg-white/10"
              >
                {side === 'buy' ? '−' : '+'}{p}%
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={save}
          disabled={numPrice <= 0}
          className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}