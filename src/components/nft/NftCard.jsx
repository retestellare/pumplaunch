import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useWallet } from '@/lib/wallet';
import { mintEdition, fmtMintPrice, editionLabel, mintProgress } from '@/lib/nft';
import MintProgress from './MintProgress';
import { Sparkles } from 'lucide-react';

export default function NftCard({ collection, onMinted }) {
  const { wallet, connect } = useWallet();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const { minted, total, soldOut } = mintProgress(collection);

  const mint = async () => {
    if (!wallet) {
      connect();
      return;
    }
    setBusy(true);
    const res = await mintEdition(collection);
    setBusy(false);
    if (!res.ok) {
      onMinted?.({ ...collection, status: 'sold_out' });
      toast({
        title: 'Sold out',
        description: `All ${total.toLocaleString()} editions of $${collection.symbol} are minted.`,
        variant: 'destructive',
      });
      return;
    }
    onMinted?.(res.collection);
    toast({ title: `Edition #${res.minted} minted`, description: `$${collection.symbol} — ${res.minted} / ${res.total}` });
  };

  return (
    <div className="bg-[#141518] rounded-2xl p-3 space-y-3 border border-white/5">
      <div className="flex items-start gap-3">
        {collection.media_url ? (
          <Image
            src={collection.media_url}
            fittingType="fill"
            alt={collection.name}
            className="w-16 h-16 rounded-xl border border-white/5 shrink-0"
          />
        ) : (
          <div className="w-16 h-16 rounded-xl bg-black/30 border border-white/5 flex items-center justify-center shrink-0">
            <Sparkles size={20} className="text-white/30" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">{collection.name}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#00ff88]/10 text-[#00ff88] font-bold shrink-0">
              {collection.edition_type === 'limited' ? 'LIMITED' : '1/1'}
            </span>
          </div>
          <div className="text-xs text-white/40 truncate">
            ${collection.symbol} · {editionLabel(collection)}
            {collection.royalty_percent > 0 ? ` · ${collection.royalty_percent}% royalty` : ''}
          </div>
          {collection.description && (
            <p className="text-[11px] text-white/35 mt-1">{collection.description}</p>
          )}
        </div>
      </div>

      <MintProgress collection={{ ...collection, minted_count: minted }} />

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{fmtMintPrice(collection)}</span>
        <button
          onClick={mint}
          disabled={busy || soldOut}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition select-none disabled:opacity-50 ${
            soldOut ? 'bg-white/5 text-white/30' : 'bg-[#00ff88] text-black'
          }`}
        >
          {soldOut ? 'Sold out' : busy ? 'Minting…' : wallet ? 'Mint' : 'Connect'}
        </button>
      </div>
    </div>
  );
}