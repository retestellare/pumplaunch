import { Image } from '@/components/ui/image';
import { useResolvedImage } from '@/lib/tokenImages';

const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#c7a8ff', '#ffaaa5', '#7fd8ff', '#ffb3d9', '#ffd166', '#06d6a0'];

export default function TokenIcon({ token, size = 40, shape = 'circle' }) {
  const sym = token?.symbol || token?.code || token?.name || '?';
  const radius = shape === 'square' ? 'rounded-xl' : 'rounded-full';
  // An asset with no artwork of its own shows the logo its issuer publishes in
  // stellar.toml — the same one the Stellar wallets display.
  const image = useResolvedImage(token);

  if (image) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`${radius} overflow-hidden shrink-0 ring-1 ring-[#16211E]`}
      >
        <Image src={image} alt={sym} fittingType="fill" className="w-full h-full" />
      </div>
    );
  }

  const color = COLORS[sym.charCodeAt(0) % COLORS.length] || COLORS[0];
  return (
    <div
      style={{ width: size, height: size, background: color, fontSize: size * 0.4 }}
      className={`${radius} flex items-center justify-center font-black text-black/80 shrink-0`}
    >
      {sym.charAt(0).toUpperCase()}
    </div>
  );
}