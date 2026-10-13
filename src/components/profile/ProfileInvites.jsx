import { Link } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import { shortAddr } from '@/lib/profiles';
import { timeAgo } from '@/lib/timeAgo';

// Wallets that joined through this member's invite link, and whether each one
// has qualified for the reward.
export default function ProfileInvites({ invites }) {
  if (invites.length === 0) {
    return <p className="text-sm text-white/30 px-1 py-6 text-center">No invites yet.</p>;
  }

  return (
    <div className="bg-[#141518] rounded-2xl divide-y divide-white/5">
      {invites.map((invite) => (
        <Link
          key={invite.id}
          to={`/profile/${invite.referred_wallet}`}
          className="flex items-center gap-3 px-3.5 py-3 active:bg-white/5"
        >
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold font-mono truncate">
              {shortAddr(invite.referred_wallet)}
            </p>
            <p className="text-[10px] text-white/35 mt-0.5">
              {timeAgo(invite.created_date)} ·{' '}
              {invite.verified ? 'qualified — reward credited' : 'still qualifying'}
            </p>
          </div>
          {invite.verified ? (
            <CheckCircle2 size={15} className="text-[#00ff88] shrink-0" />
          ) : (
            <Clock size={15} className="text-white/25 shrink-0" />
          )}
        </Link>
      ))}
    </div>
  );
}