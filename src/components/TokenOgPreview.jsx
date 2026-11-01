import { Image } from '@/components/ui/image';
import ShareButton from '@/components/ShareButton';
import { tokenShare } from '@/lib/share';

export default function TokenOgPreview({ token, url, imageFile, price, change24h }) {
  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold">Social Preview</h3>
        <p className="text-[11px] text-white/40 mt-0.5">
          Generated automatically for ${token.symbol} — it travels with every share.
        </p>
      </div>
      <Image
        src={url}
        fittingType="fill"
        alt={`$${token.symbol} share preview`}
        className="w-full aspect-[1200/630] rounded-xl border border-white/5"
      />
      <ShareButton
        payload={tokenShare({ token, price, change24h })}
        imageFile={imageFile}
        label={`Share $${token.symbol}`}
      />
    </div>
  );
}