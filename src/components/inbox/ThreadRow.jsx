import { Link } from 'react-router-dom';
import Avatar from '@/components/Avatar';
import { displayName } from '@/lib/profiles';
import { notificationAge } from '@/lib/notifications';

// One conversation: who wrote, how much of it was read, and the last line.
export default function ThreadRow({ thread, onAccept }) {
  const at = new Date(thread.last.created_date).getTime();
  const mine = thread.last.from_wallet !== thread.address;

  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link to={`/messages/${thread.address}`} className="shrink-0">
        <Avatar profile={thread.profile} address={thread.address} size={46} />
      </Link>
      <Link to={`/messages/${thread.address}`} className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-bold text-white">
            {displayName(thread.profile, thread.address)}
          </span>
          <span className="ml-auto shrink-0 text-[11px] text-white/35">{notificationAge(at)}</span>
        </div>
        <p
          className={`mt-0.5 truncate text-xs ${
            thread.unread > 0 ? 'font-semibold text-white/85' : 'text-white/40'
          }`}
        >
          {mine ? 'You: ' : ''}
          {thread.last.body}
        </p>
      </Link>
      {onAccept ? (
        <button
          onClick={() => onAccept(thread.address)}
          className="shrink-0 h-8 rounded-lg border border-[#00ff88]/40 bg-[#00ff88]/10 px-2.5 text-[10px] font-black uppercase tracking-[.07em] text-[#00ff88]"
        >
          Accept
        </button>
      ) : (
        thread.unread > 0 && (
          <span className="shrink-0 min-w-[20px] h-[20px] rounded-md bg-[#00ff88] px-1 text-center text-[11px] font-black leading-[20px] text-black">
            {thread.unread}
          </span>
        )
      )}
    </div>
  );
}