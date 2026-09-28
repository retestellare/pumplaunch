export const STEPS = [
  { id: 'issuer', label: 'Create issuer account' },
  { id: 'issue', label: 'Issue tokens' },
  { id: 'liquidity', label: 'Seed liquidity' },
  { id: 'list', label: 'List in app' },
];

export default function LaunchStepTracker({ steps = STEPS, currentStep, statuses = {} }) {
  const order = steps.map((s) => s.id);
  const idx = Math.max(0, order.indexOf(currentStep));

  return (
    <div className="bg-[#141518] rounded-2xl p-4">
      <h3 className="text-xs text-white/40 mb-3">Launch progress</h3>
      <div className="space-y-3">
        {steps.map((s, i) => {
          const status = statuses[s.id] || (i < idx ? 'done' : i === idx ? 'current' : 'pending');
          const badge =
            status === 'done'
              ? 'bg-[#00ff88] text-black'
              : status === 'current'
              ? 'bg-[#00ff88]/20 ring-2 ring-[#00ff88] text-[#00ff88]'
              : status === 'failed'
              ? 'bg-[#ff3b5c] text-white'
              : 'bg-white/10 text-white/40';
          return (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${badge}`}>
                {status === 'done' ? '✓' : status === 'failed' ? '!' : i + 1}
              </div>
              <span className={`text-sm ${status === 'pending' ? 'text-white/40' : 'text-white/90'}`}>{s.label}</span>
              {status === 'current' && <span className="ml-auto text-[10px] text-[#00ff88]">in progress</span>}
              {status === 'failed' && <span className="ml-auto text-[10px] text-[#ff3b5c]">failed</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}