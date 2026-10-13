// One labelled figure in a management card. `tone` colours a value that carries
// a direction (green up, red down).
export default function StatRow({ label, value, tone, hint }) {
  const color = tone === 'up' ? 'text-[#00ff88]' : tone === 'down' ? 'text-[#ff3b5c]' : 'text-white';
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className="text-right min-w-0">
        <span className={`font-semibold ${color}`}>{value}</span>
        {hint && <span className="text-white/30 block text-[10px]">{hint}</span>}
      </span>
    </div>
  );
}