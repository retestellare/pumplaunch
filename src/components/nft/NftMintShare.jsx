import { useState } from 'react';
import { Share2, Send, Twitter } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  imageFileFromUrl,
  mintedEditionNumber,
  nftMintShare,
  sharePayload,
  telegramShareUrl,
  xShareUrl,
} from '@/lib/share';

const BTN =
  'flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold select-none disabled:opacity-50';

// Shown the moment an edition is paid for: the purchase goes out with the
// collection's artwork attached and its description in the message.
export default function NftMintShare({ collection, edition }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const payload = nftMintShare({ collection, edition });
  const total = Math.max(1, collection?.total_supply || 1);
  const number = mintedEditionNumber(collection, edition);

  const share = async () => {
    setBusy(true);
    const imageFile = await imageFileFromUrl(
      collection?.media_url,
      `${collection?.symbol || 'nft'}-edition-${number}.png`
    );
    await sharePayload({ ...payload, imageFile, toast });
    setBusy(false);
  };

  return (
    <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-3 space-y-2">
      <div className="text-[11px] font-bold text-[#00ff88]">
        Edition #{number} of {total} is yours on Stellar Mainnet
      </div>
      <div className="flex gap-2">
        <button onClick={share} disabled={busy} className={`${BTN} flex-1 bg-[#00ff88] text-black`}>
          <Share2 size={14} /> {busy ? 'Opening…' : 'Share'}
        </button>
        <a
          href={xShareUrl(payload)}
          target="_blank"
          rel="noreferrer"
          className={`${BTN} flex-1 bg-white/5 text-white`}
        >
          <Twitter size={14} /> X
        </a>
        <a
          href={telegramShareUrl(payload)}
          target="_blank"
          rel="noreferrer"
          className={`${BTN} flex-1 bg-white/5 text-white`}
        >
          <Send size={14} /> Telegram
        </a>
      </div>
      <p className="text-[10px] text-white/35">
        {collection?.description
          ? 'Your post carries the collection artwork and description.'
          : 'Your post carries the collection artwork.'}
      </p>
    </div>
  );
}