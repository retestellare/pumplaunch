import { CheckCircle2 } from 'lucide-react';
import { normalizeXHandle, xProfileUrl } from '@/lib/xAccount';

// The profile's link to its X account, as it appears on the wallet profile card.
export default function XAccountRow({ handle, onConnect }) {
  const clean = normalizeXHandle(handle);

  if (!clean) {
    return (
      <button
        onClick={onConnect}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-[#00ff88]/30 text-[#00ff88] text-xs font-bold"
      >
        Connect X account
      </button>
    );
  }

  return (
    <a
      href={xProfileUrl(clean)}
      target="_blank"
      rel="noreferrer"
      className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-black/30 border border-[#00ff88]/25"
    >
      <CheckCircle2 size={14} className="text-[#00ff88]" />
      <span className="text-xs font-bold text-white/80">@{clean}</span>
      <span className="text-[10px] text-white/30">on X</span>
    </a>
  );
}