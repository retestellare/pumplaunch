import { mintProgress } from '@/lib/nft';

export default function MintProgress({ collection }) {
  const { minted, total, percent, soldOut } = mintProgress(collection);
  return (
    <div className="space-y-1">
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${soldOut ? 'bg-white/40' : 'bg-[#00ff88]'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px]">
        <span className="text-white/40">
          {minted.toLocaleString()} / {total.toLocaleString()} Minted
        </span>
        <span className={soldOut ? 'text-white/40 font-bold' : 'text-[#00ff88] font-bold'}>
          {soldOut ? 'SOLD OUT' : `${percent}%`}
        </span>
      </div>
    </div>
  );
}