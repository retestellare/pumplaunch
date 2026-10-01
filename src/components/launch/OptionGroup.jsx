export default function OptionGroup({ label, options, isSelected, onSelect, disabled, note }) {
  return (
    <div>
      <label className="text-xs text-white/40 mb-2 block">{label}</label>
      <div className="space-y-2">
        {options.map((opt) => {
          const selected = isSelected(opt);
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt)}
              disabled={disabled}
              className={`w-full text-left px-4 py-3 rounded-xl border transition disabled:opacity-40 ${
                selected ? 'border-[#00ff88] bg-[#00ff88]/5' : 'border-white/5 bg-black/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">{opt.label}</span>
                {selected && <span className="text-[#00ff88] text-xs">✓</span>}
              </div>
              {opt.desc && <div className="text-xs text-white/40 mt-0.5">{opt.desc}</div>}
              {opt.meta && <div className="text-[10px] text-white/30 mt-0.5">{opt.meta}</div>}
            </button>
          );
        })}
      </div>
      {note}
    </div>
  );
}