import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox } from 'lucide-react';
import { useWallet } from '@/lib/wallet';
import { unreadActivity, unreadMessages } from '@/lib/social';

const POLL_MS = 60000;

// The way into messages from the social feed: how much is waiting, at a glance.
export default function InboxButton() {
  const { wallet } = useWallet();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!wallet?.address) {
      setUnread(0);
      return undefined;
    }
    let active = true;
    const load = async () => {
      const [messages, notes] = await Promise.all([
        unreadMessages(wallet.address).catch(() => 0),
        unreadActivity(wallet.address).catch(() => 0),
      ]);
      if (active) setUnread(messages + notes);
    };
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [wallet?.address]);

  return (
    <Link to="/inbox" aria-label="Inbox" className="relative text-white/70 transition duration-200 hover:text-[#00ff88]">
      <Inbox size={20} />
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1 min-w-[15px] rounded-full bg-[#00ff88] px-1 text-center text-[9px] font-black leading-[15px] text-black">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}