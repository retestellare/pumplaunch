export default function ProfileTabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 bg-[#141518] rounded-2xl p-1">
      {tabs.map((tab) => {
        const on = active === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition ${
              on ? 'bg-[#00ff88] text-black' : 'text-white/50'
            }`}
          >
            {tab.label}
            <span className={`ml-1 text-[10px] ${on ? 'text-black/50' : 'text-white/30'}`}>
              {tab.count ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}