import { useEffect, useState } from 'react';
import { Download, Send, Share2, Twitter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { sharePayload, telegramShareUrl, xShareUrl } from '@/lib/share';

const BTN =
  'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold select-none disabled:opacity-50';

// Shows the artwork that will ride with the post and offers every destination
// the app already shares to: the device sheet (image attached when it can),
// X, Telegram, or saving the image to attach by hand.
export default function ShareCardBlock({ build, payload, filename, note }) {
  const { toast } = useToast();
  const [card, setCard] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  // Drawn once per mount — callers pass a `key` so a change of content (a new
  // link, another post) remounts the block and redraws the card.
  useEffect(() => {
    let alive = true;
    let made = null;
    Promise.resolve()
      .then(() => build?.())
      .then((result) => {
        made = result || null;
        if (!alive) {
          if (made?.url) URL.revokeObjectURL(made.url);
          return;
        }
        setCard(made);
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => {
      alive = false;
      if (made?.url) URL.revokeObjectURL(made.url);
    };
  }, []);

  const share = async () => {
    setBusy(true);
    try {
      await sharePayload({ ...payload, imageFile: card?.file, toast });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2.5">
      <div className="relative rounded-xl overflow-hidden border border-[#00F59B]/20 bg-black/40">
        {card?.url ? (
          <img src={card.url} alt="Share card" className="w-full block" />
        ) : (
          <div className="aspect-[1200/630] flex items-center justify-center">
            {ready ? (
              <span className="text-[10px] text-[#F2F7F4]/40">Card unavailable on this device</span>
            ) : (
              <div className="w-6 h-6 border-2 border-white/10 border-t-[#00F59B] rounded-full animate-spin" />
            )}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={share} disabled={busy} className={`${BTN} flex-1 bg-[#00F59B] text-[#04100B]`}>
          <Share2 size={14} /> {busy ? 'Opening…' : 'Share'}
        </button>
        <a
          href={xShareUrl(payload)}
          target="_blank"
          rel="noreferrer"
          className={`${BTN} flex-1 bg-white/5 text-[#F2F7F4]`}
        >
          <Twitter size={14} /> X
        </a>
        <a
          href={telegramShareUrl(payload)}
          target="_blank"
          rel="noreferrer"
          className={`${BTN} flex-1 bg-white/5 text-[#F2F7F4]`}
        >
          <Send size={14} /> Telegram
        </a>
        {card?.url && (
          <a
            href={card.url}
            download={filename || 'stellar-pump.png'}
            aria-label="Save image"
            className={`${BTN} px-3 bg-white/5 text-[#F2F7F4]`}
          >
            <Download size={14} />
          </a>
        )}
      </div>

      {note && <p className="text-[10px] text-[#F2F7F4]/35">{note}</p>}
    </div>
  );
}