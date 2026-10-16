import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

// The switch that turns phone push notifications on and off. The choice is saved
// on the account, so the platform knows who to send to.
export default function NotificationToggle() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    base44.auth
      .me()
      .then((user) => {
        if (active && user) setEnabled(user.push_notifications !== false);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const toggle = async () => {
    const next = !enabled;
    setEnabled(next);
    setSaving(true);
    try {
      await base44.auth.updateMe({ push_notifications: next });
      toast({ title: next ? 'Notifications on' : 'Notifications off' });
    } catch {
      setEnabled(!next);
      toast({
        title: 'Could not save that',
        description: 'Sign in to manage notification settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full flex items-center gap-3 px-3 py-3 rounded-[12px]">
      <span className="w-9 h-9 rounded-[10px] bg-[#16211E] border border-[#00F59B]/20 text-[#00F59B] flex items-center justify-center shrink-0">
        <Bell size={17} />
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[13px] font-bold text-[#F2F7F4]">Notifications</span>
        <span className="block text-[11px] text-[#F2F7F4]/40 truncate">
          Phone alerts for launches and callouts
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label="Notifications"
        disabled={loading || saving}
        onClick={toggle}
        className={`shrink-0 w-[46px] h-[26px] rounded-full border flex items-center px-[3px] select-none transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B] disabled:opacity-60 ${
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