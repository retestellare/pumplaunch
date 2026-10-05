import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';

export default function DeleteAccountPanel({ onDeleted }) {
  const { wallet, disconnect } = useWallet();
  const { toast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const remove = async () => {
    if (!wallet?.address) return;
    setDeleting(true);
    try {
      const address = wallet.address;
      await base44.entities.Post.deleteMany({ author: address });
      await base44.entities.Comment.deleteMany({ author: address });
      await base44.entities.Profile.deleteMany({ wallet_address: address });
      await base44.entities.Activity.deleteMany({ wallet_address: address });

      if (await base44.auth.isAuthenticated()) {
        // Clears the session and reloads the app.
        await base44.auth.logout();
        return;
      }

      await disconnect();
      toast({
        title: 'Account deleted',
        description: 'Your profile, posts, comments and activity history were removed.',
      });
      onDeleted?.();
    } catch (e) {
      toast({ title: 'Could not delete the account', description: e.message || String(e), variant: 'destructive' });
    }
    setDeleting(false);
  };

  return (
    <div className="border-t border-white/5 pt-4">
      <h3 className="text-sm font-bold text-[#ff3b5c]">Danger Zone</h3>
      <p className="text-[11px] text-white/40 mt-1">
        Deleting your account removes your profile, posts, comments and activity history from the app and signs you
        out. This cannot be undone. Your wallet and the funds in it are never touched.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="w-full mt-3 py-3 rounded-xl border border-[#ff3b5c]/30 text-[#ff3b5c] font-bold text-sm"
        >
          Delete Account
        </button>
      ) : (
        <div className="mt-3 bg-[#ff3b5c]/5 border border-[#ff3b5c]/30 rounded-xl p-3 space-y-3">
          <p className="text-xs text-white/70">
            Are you sure? Everything listed above is permanently erased and cannot be restored.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={remove}
              disabled={deleting}
              className="flex-1 py-2.5 rounded-xl bg-[#ff3b5c] text-black font-bold text-sm disabled:opacity-50"
            >
              {deleting ? 'Deleting…' : 'Yes, delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}