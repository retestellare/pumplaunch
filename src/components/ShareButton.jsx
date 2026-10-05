import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sharePayload } from '@/lib/share';

const VARIANTS = {
  solid: 'bg-[#00ff88] text-black font-bold',
  ghost: 'bg-white/5 text-white font-bold',
};

export default function ShareButton({ payload, label = 'Share', variant = 'solid', className = '' }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    setBusy(true);
    await sharePayload({ ...payload, toast });
    setBusy(false);
  };

  if (variant === 'icon') {
    return (
      <button
        onClick={handleShare}
        disabled={busy}
        aria-label="Share"
        className={`p-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 transition disabled:opacity-50 ${className}`}
      >
        <Share2 size={18} />
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      disabled={busy}
      className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      <Share2 size={16} />
      {busy ? 'Opening…' : label}
    </button>
  );
}