import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import { accountDataRows, purgeAccount, summarizeAccount } from '@/lib/accountDeletion';
import DeleteConfirmStep from '@/components/account/DeleteConfirmStep';
import DeleteDoneStep from '@/components/account/DeleteDoneStep';

export default function DeleteAccountPanel({ onDeleted }) {
  const { wallet, disconnect } = useWallet();
  const { toast } = useToast();
  const [step, setStep] = useState('idle');
  const [target, setTarget] = useState(null);
  const [rows, setRows] = useState(null);
  const [progress, setProgress] = useState('');
  const [failed, setFailed] = useState([]);
  const [signedIn, setSignedIn] = useState(false);

  const walletAddress = wallet?.address;

  const open = async () => {
    setTarget(walletAddress);
    setRows(null);
    setStep('confirm');
    setRows(accountDataRows(await summarizeAccount(walletAddress)));
  };

  const confirm = async () => {
    setStep('working');
    setFailed([]);
    const { failed: missed } = await purgeAccount(target, setProgress);
    setFailed(missed);
    setSignedIn(await base44.auth.isAuthenticated().catch(() => false));
    await disconnect();
    setStep('done');
    toast({ title: 'Account deleted', description: 'Your profile and history were removed.' });
  };

  if (step === 'done') {
    return (
      <DeleteDoneStep
        address={target}
        failed={failed}
        signedIn={signedIn}
        onSignOut={() => base44.auth.logout()}
        onDone={() => onDeleted?.()}
      />
    );
  }

  // Nothing to delete without a connected wallet.
  if (!walletAddress) return null;

  return (
    <div className="border-t border-white/5 pt-4">
      <h3 className="text-sm font-bold text-[#ff3b5c]">Danger Zone</h3>
      <p className="text-[11px] text-white/40 mt-1">
        Deleting your account erases your profile, posts, comments, trades and activity history, and disconnects your
        wallet. This cannot be undone.
      </p>

      {step === 'idle' ? (
        <button
          onClick={open}
          className="w-full mt-3 py-3 rounded-xl border border-[#ff3b5c]/30 text-[#ff3b5c] font-bold text-sm"
        >
          Delete Account
        </button>
      ) : (
        <DeleteConfirmStep
          rows={rows}
          busy={step === 'working'}
          progress={progress}
          onCancel={() => setStep('idle')}
          onConfirm={confirm}
        />
      )}
    </div>
  );
}