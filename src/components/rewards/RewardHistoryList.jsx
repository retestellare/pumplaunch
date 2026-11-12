import { shortAddr } from '@/lib/profiles';

const fmt = (n) => (Number(n) > 0 ? Math.round(Number(n)).toLocaleString('en-US') : '0');

function rowLabel(row) {
  if (row.side === 'inviter') return `Invited ${shortAddr(row.referred_wallet)}`;
  return 'Welcome reward — joined with an invite';
}

function when(row) {
  if (!row.created_date) return '';
  const date = new Date(row.created_date);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// Every credit this wallet has earned, newest first.
export default function RewardHistoryList({ items = [], loading }) {
  return (
    <section className="bg-[#141518] rounded-2xl p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold">Reward history</h3>
        {items.length > 0 && <span className="text-[10px] text-[#F2F7F4]/30">{items.length}</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[#00F59B] rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-[11px] text-[#F2F7F4]/35 py-4">
          No rewards yet. Share your invite link — the first completed profile pays both of you.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-white/[.05]">
          {items.map((row) => (
            <li key={row.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold text-[#F2F7F4]/80 truncate">{rowLabel(row)}</span>
                <span className="block text-[9.5px] text-[#F2F7F4]/35 mt-0.5">
                  {when(row)}
                  {row.status === 'paid' ? ' · sent' : ' · waiting to be requested'}
                </span>
              </span>
              <span
                className={`shrink-0 text-[11px] font-bold ${
                  row.status === 'paid' ? 'text-[#F2F7F4]/35' : 'text-[#00F59B]'
                }`}
              >
                +{fmt(row.plunch)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}