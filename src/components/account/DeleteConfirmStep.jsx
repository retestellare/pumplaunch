import { useState } from 'react';
import { Loader2 } from 'lucide-react';

const CONFIRM_WORD = 'DELETE';

export default function DeleteConfirmStep({ rows, busy, progress, onCancel, onConfirm }) {
  const [word, setWord] = useState('');
  const ready = word.trim().toUpperCase() === CONFIRM_WORD;

  return (
    <div className="mt-3 bg-[#ff3b5c]/5 border border-[#ff3b5c]/30 rounded-xl p-3 space-y-3">
      <p className="text-xs text-white/70">
        This permanently erases everything below. It cannot be undone.
      </p>

      {!rows ? (
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Loader2 size={14} className="animate-spin" />
          Checking what is stored for your wallet…
        </div>
      ) : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center justify-between text-xs">
              <span className="text-white/60">{r.label}</span>
              <span className="font-bold text-white/80">{r.count == null ? '—' : r.count}</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-white/40">
        Tokens you launched are on-chain assets shared with their holders, so they stay. Your wallet and the funds in it
        are never touched.
      </p>

      {busy ? (
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Loader2 size={14} className="animate-spin" />
          {progress || 'Removing your data…'}
        </div>
      ) : (
        <div>
          <label className="text-[11px] text-white/40 mb-1.5 block">Type {CONFIRM_WORD} to confirm</label>
          <input
            value={word}
            onChange={(e) => setWord(e.target.value)}
            placeholder={CONFIRM_WORD}
            autoCapitalize="characters"
            autoComplete="off"
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#ff3b5c]/50"
          />
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          disabled={busy}
          className="flex-1 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={busy || !ready}
          className="flex-1 py-2.5 rounded-xl bg-[#ff3b5c] text-black font-bold text-sm disabled:opacity-40"
        >
          Delete everything
        </button>
      </div>
    </div>
  );
}