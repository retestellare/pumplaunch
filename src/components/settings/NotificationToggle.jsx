import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import {
  notificationsEnabled,
  onNotificationPrefsChange,
  setNotificationsEnabled,
} from '@/lib/notifications';

// The switch that turns activity notifications on and off.
export default function NotificationToggle() {
  const [enabled, setEnabled] = useState(notificationsEnabled);

  useEffect(() => onNotificationPrefsChange(() => setEnabled(notificationsEnabled())), []);

  return (
    <div className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px]">
      <span className="w-9 h-9 rounded-[10px] bg-[#16211E] border border-[#00F59B]/20 text-[#00F59B] flex items-center justify-center shrink-0">
        <Bell size={17} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[13px] font-bold text-[#F2F7F4]">Notifications</span>
        <span className="block text-[11px] text-[#F2F7F4]/40 truncate">
          Launches, trades and reward alerts
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Notifications"
        onClick={() => setNotificationsEnabled(!enabled)}
        className={`shrink-0 w-[46px] h-[26px] rounded-full border flex items-center px-[3px] select-none transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B] ${
          enabled
            ? 'bg-[#00F59B] border-[#00F59B] justify-end'
            : 'bg-[#16211E] border-[#00F59B]/20 justify-start'
        }`}
      >
        <span
          className={`w-[18px] h-[18px] rounded-full transition duration-200 ${
            enabled ? 'bg-[#04100B]' : 'bg-[#F2F7F4]/70'
          }`}
        />
      </button>
    </div>
  );
}