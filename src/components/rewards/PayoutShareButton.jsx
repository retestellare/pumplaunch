import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { referralPayoutShare, sharePayload } from '@/lib/share';

// Posts the payout receipt: the device's own share sheet where there is one, the
// app's share picker everywhere else.
export default function PayoutShareButton({ amount, className = '' }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    await sharePayload({ ...referralPayoutShare({ amount }), toast });
    setBusy(false);
  };

  return (
    <button
      onClick={share}
      disabled={busy}
      className={`inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-[#00F59B]/35 bg-[#00F59B]/[.08] text-[11px] font-black uppercase tracking-[.1em] text-[#00F59B] transition duration-200 hover:bg-[#00F59B]/[.16] active:opacity-80 disabled:opacity-60 ${className}`}
    >
      <Share2 size={14} />
      {busy ? 'Opening…' : 'Share receipt'}
    </button>
  );
}