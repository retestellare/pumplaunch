import { QUOTES } from '@/lib/pools';

// Chooses which market a trade runs through. A token with a single market just
// states it instead of offering a pointless choice.
export default function PayWithSelector({ quotes, value, onChange, label = 'Pay with' }) {
  const list = quotes || ['xlm'];
  const selected = QUOTES[value] || QUOTES[list[0]] || QUOTES.xlm;

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/40">{label}</span>
      {list.length < 2 ? (
        <span className="text-xs font-bold text-white/70">{selected.label}</span>
      ) : (
        <div className="flex gap-1">
          {list.map((key) => {
            const quote = QUOTES[key];
            const active = key === value;
            return (
              <button
                key={key}
                onClick={() => onChange(key)}
                style={
                  active
                    ? { borderColor: quote.color, color: quote.color, background: `${quote.color}1f` }
                    : undefined
                }
                className={`px-3 py-1 rounded-full border text-xs font-bold transition ${
                  active ? '' : 'border-white/10 text-white/50 hover:text-white/80'
                }`}
              >
                {quote.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}