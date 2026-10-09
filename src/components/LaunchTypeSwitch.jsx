import { Link } from 'react-router-dom';

// Switches the creation screen between a memecoin launch and an NFT drop.
const TYPES = [
  { path: '/launch', label: 'Memecoin' },
  { path: '/launch-nft', label: 'NFT Collection' },
];

export default function LaunchTypeSwitch({ value }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl bg-white/5">
      {TYPES.map((t) => (
        <Link
          key={t.path}
          to={t.path}
          className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition select-none ${
            value === t.path ? 'bg-[#00ff88] text-black' : 'text-white/50'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}