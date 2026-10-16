import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import NotificationSheet from '@/components/notifications/NotificationSheet';
import { useWallet } from '@/lib/wallet';
import {
  fetchNotifications,
  markNotificationsSeen,
  notificationsEnabled,
  notificationsSeenAt,
  onNotificationPrefsChange,
} from '@/lib/notifications';

const POLL_MS = 120000;

export default function NotificationBell() {
  const { wallet } = useWallet();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(notificationsEnabled);
  const [seen, setSeen] = useState(() => notificationsSeenAt(wallet?.address));
  const [open, setOpen] = useState(false);

  useEffect(() => onNotificationPrefsChange(() => setEnabled(notificationsEnabled())), []);

  const load = useCallback(async () => {
    const list = await fetchNotifications(wallet?.address);
    setItems(list);
    setLoading(false);
  }, [wallet?.address]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const unread = enabled ? items.filter((i) => i.at > seen).length : 0;

  const openFeed = () => {
    markNotificationsSeen(wallet?.address);
    setSeen(Date.now());
    load();
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={openFeed}
        aria-label="Notifications"
        className="relative w-[34px] h-[34px] rounded-[10px] bg-[#16211E] border border-[#00F59B]/25 text-[#00F59B] flex items-center justify-center transition duration-200 hover:bg-[#1d2d29] hover:shadow-[0_0_10px_rgba(0,245,155,.4)] active:bg-[#0e1614] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-[#FF3B5C] text-[9px] font-black text-white flex items-center justify-center border border-[#0a0b0d]">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      <NotificationSheet
        open={open}
        onOpenChange={setOpen}
        items={items}
        loading={loading}
        enabled={enabled}
      />
    </>
  );
}