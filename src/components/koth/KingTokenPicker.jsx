import TokenIcon from '@/components/TokenIcon';

// Only launched PumpLaunch tokens can be nominated — the stake names a real asset.
export default function KingTokenPicker({ tokens, value, onChange, kingTokenId }) {
  if (!tokens.length) {
    return (
      <p className="rounded-[12px] border border-[#16211E] px-3 py-3 text-[12px] text-[#F2F7F4]/40">
        No launched tokens to nominate yet.
      </p>
    );
  }

  return (
    <div className="max-h-[196px] divide-y divide-[#16211E] overflow-y-auto rounded-[12px] border border-[#16211E]">
      {tokens.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`flex w-full items-center gap-2 px-2.5 py-2 text-left transition duration-200 ${
              active ? 'bg-[#00F59B]/10' : 'hover:bg-[#0f1815]'
            }`}
          >
            <TokenIcon token={t} size={30} shape="square" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-extrabold">${t.symbol}</span>
              <span className="block truncate text-[10px] uppercase tracking-[.04em] text-[#F2F7F4]/40">
                {t.name}
              </span>
            </span>
            {t.id === kingTokenId && <span className="text-[11px] leading-none">👑</span>}
            {active && (
              <span className="text-[9px] font-black uppercase tracking-[.08em] text-[#00F59B]">
                Picked
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}