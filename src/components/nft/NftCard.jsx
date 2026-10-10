import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { useToast } from '@/components/ui/use-toast';
import { useWallet } from '@/lib/wallet';
import { fmtMintPrice, editionLabel, mintProgress } from '@/lib/nft';
import { estimateMintCost, fetchCollectionState, isOnChain, mintNft } from '@/lib/nftLaunch';
import { loadAccount } from '@/lib/stellar';
import MintProgress from './MintProgress';
import NftMintShare from './NftMintShare';
import { Sparkles } from 'lucide-react';

export default function NftCard({ collection, onMinted }) {
  const { wallet, connect } = useWallet();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [cost, setCost] = useState(null);
  const [mintedEdition, setMintedEdition] = useState(null);
  const { minted, soldOut } = mintProgress(collection);
  const onChain = isOnChain(collection);

  // A mint is a mainnet purchase, so the price, the fee and any trustline
  // reserve are shown before the wallet is asked to sign.
  const prepare = async () => {
    if (!wallet) {
      connect();
      return;
    }
    setConfirming(true);
    setCost(null);
    const [account, state] = await Promise.all([
      loadAccount(wallet.address).catch(() => null),
      fetchCollectionState(collection).catch(() => null),
    ]);

    // Editions can also go from the order book without the app, so the sale is
    // checked before the wallet is asked to sign a payment that cannot fill.
    if (state && !state.onSale) {
      setConfirming(false);
      const exhausted = state.minted >= (collection.total_supply || 1);
      onMinted?.({ ...collection, minted_count: state.minted, status: exhausted ? 'sold_out' : collection.status });
      toast({
        title: exhausted ? 'Sold out' : 'The sale is not open',
        description: exhausted
          ? `All ${(collection.total_supply || 1).toLocaleString()} editions of $${collection.symbol} are gone.`
          : 'No sell order is open on the Stellar DEX for this drop.',
        variant: 'destructive',
      });
      return;
    }

    if (!account) {
      setConfirming(false);
      toast({
        title: 'No XLM on Stellar Mainnet',
        description: 'Fund this wallet with XLM before minting.',
        variant: 'destructive',
      });
      return;
    }

    setCost(estimateMintCost({ account, collection }));
  };

  const mint = async () => {
    if (!wallet) return;
    setBusy(true);
    try {
      const res = await mintNft({ address: wallet.address, collection });
      onMinted?.(res.collection || collection);
      setConfirming(false);
      setMintedEdition(res.minted);
      toast({
        title: `Edition #${res.minted} minted`,
        description: `$${collection.symbol} — ${res.minted} / ${res.total}, delivered on Stellar Mainnet.`,
      });
    } catch (e) {
      toast({
        title: 'That mint did not go through',
        description: e?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
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
        <div>
          <span className="text-sm font-bold">{fmtMintPrice(collection)}</span>
          {onChain && <span className="ml-2 text-[10px] text-white/30">on Stellar Mainnet</span>}
        </div>
        {!confirming && (
          <button
            onClick={prepare}
            disabled={busy || soldOut || !onChain}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition select-none disabled:opacity-50 ${
              soldOut || !onChain ? 'bg-white/5 text-white/30' : 'bg-[#00ff88] text-black'
            }`}
          >
            {!onChain ? 'Not on-chain' : soldOut ? 'Sold out' : wallet ? 'Mint' : 'Connect'}
          </button>
        )}
      </div>

      {mintedEdition && !confirming && (
        <NftMintShare collection={{ ...collection, minted_count: minted }} edition={mintedEdition} />
      )}

      {confirming && (
        <div className="bg-black/30 rounded-xl p-3 space-y-2 border border-[#00ff88]/20">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/50">Paid on Mainnet</span>
            <span className="font-bold">{fmtMintPrice(collection)}</span>
          </div>
          {cost ? (
            <>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-white/50">Network fee</span>
                <span className="text-white/70">{cost.feeXlm.toFixed(7)} XLM</span>
              </div>
              {cost.reserveXlm > 0 && (
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/50">New trustline reserve (locked)</span>
                  <span className="text-white/70">{cost.reserveXlm} XLM</span>
                </div>
              )}
            </>
          ) : (
            <p className="text-[10px] text-white/40">Reading your wallet balance…</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="flex-1 py-2 rounded-lg bg-white/5 text-xs font-bold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={mint}
              disabled={busy || !cost}
              className="flex-1 py-2 rounded-lg bg-[#00ff88] text-black text-xs font-bold disabled:opacity-50"
            >
              {busy ? 'Minting…' : 'Confirm mint'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}