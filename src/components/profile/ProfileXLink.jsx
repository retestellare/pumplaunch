import { normalizeXHandle, xProfileUrl } from '@/lib/xAccount';

// The profile's X account, if one is linked.
export default function ProfileXLink({ handle }) {
  const clean = normalizeXHandle(handle);
  if (!clean) return null;

  return (
    <a
      href={xProfileUrl(clean)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full bg-[#00ff88]/10 border border-[#00ff88]/25"
    >
      <span className="text-[11px] font-bold text-[#00ff88]">@{clean}</span>
      <span className="text-[10px] text-white/40">on X</span>
    </a>
  );
}