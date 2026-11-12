import { useState } from 'react';
import { User, Wallet, Gift, Inbox, Users } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import SettingsRow from '@/components/settings/SettingsRow';
import NotificationToggle from '@/components/settings/NotificationToggle';
import ProfileEditor from '@/components/ProfileEditor';
import Avatar from '@/components/Avatar';
import { useWallet } from '@/lib/wallet';
import { shortAddr } from '@/lib/profiles';

// The account menu behind the avatar in the home header: who you are, and the
// settings that belong to this wallet.
export default function SettingsMenu({ open, onOpenChange, profile, onProfileSaved }) {
  const { wallet } = useWallet();
  const [editing, setEditing] = useState(false);

  const close = () => onOpenChange(false);
  const openProfile = () => {
    close();
    setEditing(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="bg-[#0a0b0d] border-white/5 p-0 max-h-[88vh] overflow-y-auto"
        >
          <SheetTitle className="sr-only">Settings</SheetTitle>
          <div className="p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-3 px-1 pb-3.5 border-b border-[#16211E]">
              <Avatar profile={profile} address={wallet?.address} size={44} />
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#F2F7F4] truncate">
                  {profile?.display_name || (wallet ? shortAddr(wallet.address) : 'No wallet connected')}
                </p>
                <p className="text-[11px] font-mono text-[#F2F7F4]/35 truncate">
                  {wallet ? shortAddr(wallet.address) : 'Connect to manage your profile'}
                </p>
              </div>
            </div>

            <p className="text-[10px] font-black tracking-[.14em] uppercase text-[#F2F7F4]/35 px-1 pt-4 pb-1">
              Settings
            </p>
            <div className="space-y-0.5">
              <SettingsRow
                icon={User}
                label="Profile settings"
                description="Name, avatar, X account and bio"
                onClick={openProfile}
              />
              <SettingsRow
                icon={Wallet}
                label="Wallet & assets"
                description="Balances, holdings and activity"
                to="/portfolio"
                onClick={close}
              />
              <SettingsRow
                icon={Gift}
                label="Rewards"
                description="Invites, PLUNCH and payouts"
                to="/rewards"
                onClick={close}
              />
              <SettingsRow
                icon={Inbox}
                label="Inbox"
                description="Messages, activity and requests"
                to="/inbox"
                onClick={close}
              />
              <SettingsRow
                icon={Users}
                label="Teams"
                description="Create a team or join one"
                to="/teams"
                onClick={close}
              />
              {wallet?.address && (
                <SettingsRow
                  icon={User}
                  label="My profile"
                  description="How others see you"
                  to={`/profile/${wallet.address}`}
                  onClick={close}
                />
              )}
              <NotificationToggle />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {editing && (
        <div className="fixed inset-0 z-[60] bg-[#0a0b0d] max-w-lg mx-auto overflow-y-auto">
          <ProfileEditor
            onDone={() => {
              setEditing(false);
              onProfileSaved?.();
            }}
          />
        </div>
      )}
    </>
  );
}