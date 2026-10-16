import { Image } from '@/components/ui/image';
import Avatar from '@/components/Avatar';
import { MASCOT_IMAGE } from '@/lib/brandAssets';

// The settings entry point in the home header: the wallet's own picture once one
// is set, the mascot until then.
export default function HeaderAvatar({ profile, address, onOpenSettings }) {
  return (
    <button
      type="button"
      onClick={onOpenSettings}
      aria-label="Settings"
      className="shrink-0 w-[26px] h-[26px] rounded-full transition duration-200 hover:shadow-[0_0_14px_rgba(0,245,155,.65)] active:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
    >
      {profile?.avatar_url ? (
        <Avatar profile={profile} address={address} size={26} />
      ) : (
        <Image
          src={MASCOT_IMAGE}
          alt=""
          fittingType="fill"
          className="w-[26px] h-[26px] rounded-full border border-[#00F59B]/45 shadow-[0_0_12px_rgba(0,245,155,.5)]"
        />
      )}
    </button>
  );
}