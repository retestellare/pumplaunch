import { Link } from 'react-router-dom';
import Avatar from '@/components/Avatar';
import { displayName } from '@/lib/profiles';
import { notificationAge } from '@/lib/notifications';

const ICON = { follow: '👤', message: '💬', team: '🤝' };

// What happened to this wallet: a new follower, a message waiting, a teammate.
export default function ActivityRow({ item }) {
  const at = new Date(item.created_date).getTime();
  const body = (
    <div className="flex items-start gap-3 py-2.5">
      <Avatar profile={item.profile} address={item.actor_wallet} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug text-white/45">
          <span className="font-bold text-white">{displayName(item.profile, item.actor_wallet)}</span>{' '}
          {item.text}
        </p>
        {item.type === 'message' && (
          <p className="mt-0.5 text-[11px] font-bold uppercase tracking-[.06em] text-[#00ff88]">
            Reply in messages
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <span className="block text-[11px] text-white/35">{notificationAge(at)}</span>
        <span className="text-[13px]">{ICON[item.type] || '•'}</span>
      </div>
    </div>
  );

  if (!item.href) return body;
  return (
    <Link to={item.href} className="block transition duration-200 active:opacity-80">
      {body}
    </Link>
  );
}