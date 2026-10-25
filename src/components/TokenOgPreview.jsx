import { useEffect, useRef, useState } from 'react';
import { Image } from '@/components/ui/image';
import { ImagePlus, Loader2, RotateCcw } from 'lucide-react';
import ShareButton from '@/components/ShareButton';
import { useToast } from '@/components/ui/use-toast';
import { tokenShare } from '@/lib/share';
import { customOgCard } from '@/lib/ogImage';

const PILL =
  'flex items-center gap-1.5 h-[30px] px-2.5 rounded-[10px] bg-[#0a0b0d]/85 border border-[#00F59B]/40 text-[#00F59B] text-[10px] font-black uppercase tracking-[.06em] backdrop-blur transition duration-200 hover:bg-[#00F59B]/15 active:opacity-85 disabled:opacity-50';

// The artwork that rides with the share. Its picture can be swapped for any
// photo before sharing — the chosen image lives for this visit only, so the
// token keeps its own preview for everyone else.
export default function TokenOgPreview({
  token,
  url,
  imageFile,
  price,
  change24h,
  stats,
  onCardChange,
}) {
  const { toast } = useToast();
  const inputRef = useRef(null);
  const [custom, setCustom] = useState(null);
  const [busy, setBusy] = useState(false);

  // Every replaced card lets go of its object URL.
  useEffect(
    () => () => {
      if (custom?.url) URL.revokeObjectURL(custom.url);
    },
    [custom]
  );

  const apply = (card) => {
    setCustom(card);
    onCardChange?.(card);
  };

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'That file is not a picture', variant: 'destructive' });
      return;
    }
    setBusy(true);
    const card = await customOgCard(token, stats || { price, change24h }, file).catch(() => null);
    setBusy(false);
    if (!card) {
      toast({ title: 'That picture could not be used', variant: 'destructive' });
      return;
    }
    apply(card);
  };

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold">Social Preview</h3>
        <p className="text-[11px] text-white/40 mt-0.5">
          {custom
            ? `Your own picture for $${token.symbol} — it travels with this share.`
            : `Generated automatically for $${token.symbol} — it travels with every share.`}
        </p>
      </div>
      <div className="relative">
        <Image
          src={custom?.url || url}
          fittingType="fill"
          alt={`$${token.symbol} share preview`}
          className="w-full aspect-[1200/630] rounded-xl border border-white/5"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
          {custom && (
            <button
              onClick={() => apply(null)}
              aria-label="Use the token's own picture"
              title="Back to the token's own picture"
              className="w-[30px] h-[30px] rounded-[10px] bg-[#0a0b0d]/85 border border-white/15 text-white/60 flex items-center justify-center backdrop-blur transition duration-200 hover:text-white active:opacity-85"
            >
              <RotateCcw size={13} />
            </button>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={PILL}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
            {busy ? 'Drawing' : custom ? 'Change' : 'Picture'}
          </button>
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" />
      </div>
      <ShareButton
        payload={tokenShare({ token, price, change24h })}
        imageFile={custom?.file || imageFile}
        label={`Share $${token.symbol}`}
      />
    </div>
  );
}