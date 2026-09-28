import { useState } from 'react';
import { ChevronDown, AlertTriangle, Info } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Before you start',
    items: [
      'This is a real Stellar mainnet launch — transactions are irreversible and use real XLM.',
      'Fund your wallet with enough XLM first (see the cost breakdown on the confirm screen).',
      'Keep your wallet app open; every step asks you to approve a transaction.',
    ],
  },
  {
    title: 'Symbol rules',
    items: [
      '4–12 characters, letters and numbers only (no spaces or symbols).',
      'Pick a unique symbol — if your wallet already holds a token with that symbol, we reuse it instead of creating a new one.',
      'You cannot change the symbol after launch.',
    ],
  },
  {
    title: 'Supply & distribution',
    items: [
      'Total supply is fixed at launch and can never be increased (the issuer is permanently locked).',
      '100% Liquidity seeds all tokens to the DEX; 80/20 or 50/50 keeps part in your wallet.',
      'Auto-Pool mode derives supply from your initial liquidity — more XLM in = more tokens.',
    ],
  },
  {
    title: 'Initial liquidity',
    items: [
      'Minimum 10 XLM; 50+ XLM recommended to reduce early price slippage.',
      'For Auto-Pool, this XLM goes straight into the Stellar liquidity pool.',
      'Too little liquidity = huge price swings on the first trades.',
    ],
  },
  {
    title: 'Costs to expect',
    items: [
      '~2 XLM issuer reserve — non-refundable (pays for the locked issuer account).',
      'Network fees (~0.00001 XLM per operation) and refundable reserves for offers/trustlines.',
      'Confirm-screen summary shows the exact estimated total before you pay anything.',
    ],
  },
  {
    title: 'Common mistakes to avoid',
    items: [
      'Launching with the same symbol twice — resume instead of re-launching to avoid duplicate orphan tokens.',
      'Setting a tiny liquidity amount leading to instant moon then crash.',
      'Picking a "hyper" curve so early buyers dump on later ones.',
      'Closing the page mid-launch — your progress is saved; just hit Resume.',
    ],
  },
];

export default function LaunchGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-[#141518] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <Info size={16} className="text-[#00ff88]" />
          How to launch safely
        </span>
        <ChevronDown
          size={18}
          className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="text-xs font-bold text-white/80 mb-1">{s.title}</p>
              <ul className="space-y-1">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-xs text-white/50">
                    <span className="text-[#00ff88] mt-0.5">•</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex items-start gap-2 bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-xl p-2.5">
            <AlertTriangle size={14} className="text-[#ff3b5c] mt-0.5 shrink-0" />
            <p className="text-[11px] text-white/60">
              If a step fails, don't start over — use the Resume button so you never pay the 2 XLM issuer reserve twice.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}