import { Link } from 'react-router-dom';
import Avatar from '@/components/Avatar';
import { notificationAge } from '@/lib/notifications';

// One line of the feed: who did it, and what they did.
export default function NotificationRow({ item, onOpen }) {
  const className =
    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-left select-none transition duration-200 hover:bg-[#16211E]/70 active:bg-[#0e1614]';

  const body = (
    <>
      <Avatar profile={item.profile} address={item.address} size={30} />
      <span className="flex-1 min-w-0">
        <span className="block text-[12px] leading-snug text-[#F2F7F4]">
          <span className="font-bold">{item.handle}</span> {item.text}
        </span>
        <span className="block text-[10px] text-[#F2F7F4]/35 mt-0.5">
          {notificationAge(item.at)}
        </span>
      </span>
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} onClick={onOpen} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}