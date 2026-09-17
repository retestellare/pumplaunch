const COLORS = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#c7a8ff', '#ffaaa5', '#7fd8ff', '#ffb3d9', '#ffd166', '#06d6a0'];

export default function TokenIcon({ token, size = 40 }) {
  const sym = token?.symbol || token?.name || '?';
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