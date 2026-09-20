import { shortAddr } from '@/lib/profiles';

const FALLBACK_COLORS = ['#00ff88', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#10b981'];

export default function Avatar({ profile, address, size = 36 }) {
  const url = profile?.avatar_url;
  if (url) {
    return (
      <img
        src={url}
        alt="avatar"
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const label = profile?.display_name
    ? profile.display_name.charAt(0).toUpperCase()
    : (address && address.length > 4 ? address.charAt(0).toUpperCase() : '?');
  const color = FALLBACK_COLORS[(address || label).charCodeAt(0) % FALLBACK_COLORS.length];
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}22`,
        color,
        fontSize: size * 0.4,
      }}
    >
      {label}
    </div>
  );
}