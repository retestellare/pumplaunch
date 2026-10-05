import { CheckCircle2 } from 'lucide-react';
import { shortAddr } from '@/lib/profiles';

export default function DeleteDoneStep({ address, failed, signedIn, onSignOut, onDone }) {
  return (
    <div className="border-t border-white/5 pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={18} className="text-[#00ff88]" />
        <h3 className="text-sm font-bold text-[#00ff88]">Account deleted</h3>
      </div>

      <p className="text-[11px] text-white/50">
        Everything the app stored for {shortAddr(address)} is gone: profile, posts, comments, trades, activity history
        and unfinished launch attempts. Your wallet is disconnected.
      </p>

      {failed.length > 0 && (
        <p className="text-[11px] text-[#ffb020]">
          These could not be removed: {failed.join(', ')}. Try deleting again.
        </p>
      )}

      <p className="text-[11px] text-white/30">
        Tokens you launched are on-chain assets shared with their holders, and the funds in your wallet are untouched.
      </p>

      {signedIn && (
        <p className="text-[11px] text-white/30">
          You are still signed in on this device — sign out to finish, and ask an app admin to remove the email account
          itself.
        </p>
      )}

      <div className="flex gap-2">
        {signedIn && (
          <button onClick={onSignOut} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm">
            Sign out
          </button>
        )}
        <button onClick={onDone} className="flex-1 py-2.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm">
          Done
        </button>
      </div>
    </div>
  );
}