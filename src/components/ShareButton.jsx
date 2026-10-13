import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sharePayload } from '@/lib/share';

const VARIANTS = {
  solid: 'bg-[#00ff88] text-black font-bold',
  ghost: 'bg-white/5 text-white font-bold',
};

export default function ShareButton({
  payload,
  imageFile,
  prepare,
  label = 'Share',
  variant = 'solid',
  className = '',
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    setBusy(true);
    // `prepare` builds the artwork for this share only, so a card is never
    // rendered for a button nobody pressed.
    const file = prepare ? await prepare() : imageFile;
    await sharePayload({ ...payload, imageFile: file, toast });
    setBusy(false);
  };

  if (variant === 'icon' || variant === 'flat') {
    const flat = variant === 'flat';
    return (
      <button
        onClick={handleShare}
        disabled={busy}
        aria-label="Share"
        className={`${
          flat
            ? 'flex items-center gap-1.5 text-xs text-white/50'
            : 'p-2 rounded-xl bg-white/5 text-white/70 hover:bg-white/10 transition'
        } disabled:opacity-50 ${className}`}
      >
        <Share2 size={flat ? 16 : 18} />
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