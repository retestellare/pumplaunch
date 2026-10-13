import { badgeList } from '@/lib/badges';

// A wallet's trader badges. Compact in list rows — the glyph carries the meaning —
// and labelled where there is room for the name too.
export default function TraderBadges({ keys, labelled = false }) {
  const badges = badgeList(keys);
  if (badges.length === 0) return null;

  return (
    <span className="flex items-center gap-1 shrink-0">
      {badges.map((badge) => (
        <span
          key={badge.key}
          title={`${badge.label} — ${badge.hint}`}
          className={`inline-flex items-center gap-1 rounded-full border font-bold ${
            labelled ? 'px-2 py-[3px] text-[10px] tracking-[.04em] uppercase' : 'px-[5px] py-[1px] text-[11px]'
          }`}
          style={{
            backgroundColor: `${badge.tone}1f`,
            borderColor: `${badge.tone}59`,
            color: badge.tone,
          }}
        >
          <span aria-hidden>{badge.glyph}</span>
          {labelled && badge.label}
        </span>
      ))}
    </span>
  );
}