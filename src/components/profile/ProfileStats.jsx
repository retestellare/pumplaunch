const STATS = [
  { key: 'posts', label: 'Posts' },
  { key: 'tokens', label: 'Launches' },
  { key: 'invites', label: 'Invites' },
  { key: 'trades', label: 'Trades' },
];

// What the wallet has done on the platform, each figure counted by the server.
export default function ProfileStats({ counts }) {
  return (
    <div className="mt-4 grid grid-cols-4 gap-2 w-full">
      {STATS.map((stat) => (
        <div key={stat.key} className="bg-black/25 rounded-xl py-2">
          <div className="font-mono text-sm font-bold text-[#00ff88]">{counts[stat.key] ?? 0}</div>
          <div className="text-[9px] tracking-[.06em] uppercase text-white/35 mt-0.5">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}