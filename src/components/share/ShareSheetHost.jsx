import { useEffect, useState } from 'react';
import { Copy, Send, Share2, Twitter, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { copyShare, nativeShare, telegramShareUrl, xShareUrl } from '@/lib/share';
import { SHARE_EVENT } from '@/lib/shareSheet';

const TILE =
  'flex flex-col items-center justify-center gap-1.5 py-3 rounded-[12px] border border-[#00F59B]/20 bg-[#16211E] text-[#F2F7F4] text-[10px] font-black uppercase tracking-[.08em] transition duration-200 hover:border-[#00F59B]/50 hover:text-[#00F59B] active:opacity-80';

// The share picker every share button in the app falls back to when the device
// has no share sheet of its own: post to X or Telegram, copy the link, or hand
// the message to the device again.
export default function ShareSheetHost() {
  const { toast } = useToast();
  const [payload, setPayload] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const open = (event) => setPayload(event.detail || null);
    window.addEventListener(SHARE_EVENT, open);
    return () => window.removeEventListener(SHARE_EVENT, open);
  }, []);

  if (!payload) return null;

  const { title, text, url, imageFile } = payload;
  const close = () => setPayload(null);

  const handOff = async () => {
    setBusy(true);
    const outcome = await nativeShare({ title, text, url, imageFile });
    setBusy(false);
    if (outcome === 'failed')
      toast({ title: 'No device share sheet', description: 'Use X, Telegram or Copy above.' });
    else close();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={close} aria-hidden="true" />
      <div className="relative w-full max-w-lg rounded-t-[20px] border-t border-[#00F59B]/25 bg-[#101816] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(0,0,0,.6)] animate-[sp-up_.24s_ease-out_both]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-black uppercase tracking-[.14em] text-[#F2F7F4]/45">Share</p>
          <button
            onClick={close}
            aria-label="Close"
            className="w-[30px] h-[30px] rounded-[9px] bg-[#16211E] text-[#F2F7F4]/60 flex items-center justify-center transition duration-200 hover:text-[#00F59B]"
          >
            <X size={15} />
          </button>
        </div>

        <p className="mt-2.5 rounded-[12px] border border-[#16211E] bg-black/30 p-2.5 text-[12px] leading-snug text-[#F2F7F4]/85">
          {text}
        </p>
        <p className="mt-1.5 truncate text-[11px] text-[#00F59B]/70">{url}</p>

        <div className="mt-3 grid grid-cols-4 gap-2">
          <a href={xShareUrl({ text, url })} target="_blank" rel="noreferrer" className={TILE}>
            <Twitter size={17} /> X
          </a>
          <a href={telegramShareUrl({ text, url })} target="_blank" rel="noreferrer" className={TILE}>
            <Send size={17} /> Telegram
          </a>
          <button
            onClick={async () => {
              await copyShare({ text, url, toast });
              close();
            }}
            className={TILE}
          >
            <Copy size={17} /> Copy
          </button>
          <button onClick={handOff} disabled={busy} className={`${TILE} disabled:opacity-60`}>
            <Share2 size={17} /> Device
          </button>
        </div>
      </div>
    </div>
  );
}