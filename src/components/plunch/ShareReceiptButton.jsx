import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { plunchDropShare, sharePayload } from '@/lib/share';

// Posts the day's free-drop receipt: the device's own share sheet where there is
// one, the app's share picker everywhere else.
export default function ShareReceiptButton({ amount, className = '' }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    setBusy(true);
    await sharePayload({ ...plunchDropShare({ amount }), toast });
    setBusy(false);
  };

  return (
    <button
      onClick={share}
      disabled={busy}
      aria-label="Share your free PLUNCH receipt"
      className={`inline-flex items-center gap-1.5 h-[28px] px-2.5 rounded-[8px] border border-[#00F59B]/35 bg-[#00F59B]/[.08] text-[10px] font-black uppercase tracking-[.1em] text-[#00F59B] transition duration-200 hover:bg-[#00F59B]/[.16] hover:shadow-[0_0_12px_rgba(0,245,155,.35)] active:opacity-80 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B] ${className}`}
    >
      <Share2 size={12} />
      {busy ? 'Opening…' : 'Share receipt'}
    </button>
  );
}