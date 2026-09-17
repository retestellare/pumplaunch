import { Image } from '@/components/ui/image';

const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#c7a8ff', '#ffaaa5', '#7fd8ff', '#ffb3d9', '#ffd166', '#06d6a0'];

export default function TokenIcon({ token, size = 40 }) {
  const sym = token?.symbol || token?.code || token?.name || '?';

  if (token?.image_url) {
    return (
      <div style={{ width: size, height: size }} className="rounded-full overflow-hidden shrink-0 ring-1 ring-white/10">
        <Image src={token.image_url} alt={sym} fittingType="fill" className="w-full h-full" />
      </div>
    );
  }

  const color = COLORS[sym.charCodeAt(0) % COLORS.length] || COLORS[0];
  return (
    <div
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      className="rounded-full flex items-center justify-center font-bold text-black/80 shrink-0"
    >
      {sym.charAt(0).toUpperCase()}
    </div>
  );
}