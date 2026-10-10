import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import LaunchTypeSwitch from '@/components/LaunchTypeSwitch';
import OptionGroup from '@/components/launch/OptionGroup';
import NftMediaUpload from '@/components/nft/NftMediaUpload';
import NftLaunchGuide from '@/components/nft/NftLaunchGuide';
import { Image } from '@/components/ui/image';
import { EDITION_TYPES, QUOTES, MAX_SUPPLY, buildMetadata, editionLabel, fmtMintPrice } from '@/lib/nft';
import {
  MIN_MINT_PRICE,
  estimateCollectionLaunchCost,
  explorerAssetUrl,
  launchCollectionOnChain,
} from '@/lib/nftLaunch';
import { loadAccount, parseBalances } from '@/lib/stellar';
import NftLaunchReview from '@/components/nft/NftLaunchReview';
import { Check, ExternalLink } from 'lucide-react';

const MIN_SYMBOL = 3;
const MAX_SYMBOL = 8;

const EMPTY = { name: '', symbol: '', description: '' };

export default function LaunchNft() {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [editionType, setEditionType] = useState('unique');
  const [totalSupply, setTotalSupply] = useState('10');
  const [mintPrice, setMintPrice] = useState('');
  const [quote, setQuote] = useState('xlm');
  const [royalty, setRoyalty] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(null);
  const [phase, setPhase] = useState('form');
  const [progressLabel, setProgressLabel] = useState('');
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [availableXlm, setAvailableXlm] = useState(null);

  const supply = editionType === 'unique' ? 1 : Math.min(MAX_SUPPLY, parseInt(totalSupply, 10) || 0);
  // A DEX offer prices at 7 decimals, so the price the sale holds is the price
  // every mint pays.
  const price = Math.round((parseFloat(mintPrice) || 0) * 1e7) / 1e7;
  const royaltyPct = Math.min(50, Math.max(0, parseFloat(royalty) || 0));
  const symbolOk = form.symbol.length >= MIN_SYMBOL && form.symbol.length <= MAX_SYMBOL;
  const supplyOk = editionType === 'unique' || (parseInt(totalSupply, 10) || 0) >= 2;
  const priceOk = price >= MIN_MINT_PRICE;
  const cost = estimateCollectionLaunchCost({ quote });
  const canLaunch = !!wallet && form.name.trim().length > 1 && symbolOk && supplyOk && priceOk && !launching;

  const review = async () => {
    setError('');
    setAvailableXlm(null);
    setPhase('review');
    const account = await loadAccount(wallet.address).catch(() => null);
    setAvailableXlm(account ? parseBalances(account).availableXlm : 0);
  };

  // The collection is a real Stellar asset: the creator's wallet creates the
  // issuer, the issuer seals the edition size and hands over the whole supply,
  // and the primary sale goes live as one DEX sell order at the mint price.
  const launch = async () => {
    setLaunching(true);
    setError('');
    setPhase('launching');
    try {
      let collection = draft;
      if (!collection) {
        let mediaUrl = '';
        if (mediaFile) {
          const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: mediaFile });
          mediaUrl = file_url;
        }

        const metadata = buildMetadata({
          name: form.name.trim(),
          symbol: form.symbol,
          description: form.description.trim(),
          mediaUrl,
          totalSupply: supply,
          editionType,
          royalty: royaltyPct,
          mintPrice: price,
          quote,
        });
        const metadataJson = JSON.stringify(metadata, null, 2);
        const metadataFile = new File([metadataJson], `${form.symbol.toLowerCase()}-metadata.json`, {
          type: 'application/json',
        });
        const { file_url: metadataUrl } = await base44.integrations.Core.UploadPublicFile({ file: metadataFile });

        collection = await base44.entities.NftCollection.create({
          name: metadata.name,
          symbol: metadata.symbol,
          description: metadata.description,
          edition_type: editionType,
          total_supply: supply,
          minted_count: 0,
          mint_price: price,
          quote,
          royalty_percent: royaltyPct,
          media_url: mediaUrl,
          metadata_url: metadataUrl,
          metadata_json: metadataJson,
          creator: wallet.address,
          status: 'live',
        });
        setDraft(collection);
      }

      const chain = await launchCollectionOnChain({
        address: wallet.address,
        symbol: collection.symbol,
        supply,
        price,
        quote,
        onStep: setProgressLabel,
      });

      const saved = await base44.entities.NftCollection.update(collection.id, {
        asset_code: chain.assetCode,
        issuer_public_key: chain.issuerPublicKey,
        home_domain: chain.homeDomain,
        offer_id: chain.offerId || '',
      });

      base44.analytics.track({
        eventName: 'nft_collection_launched',
        properties: { symbol: collection.symbol, edition_type: editionType, supply },
      });
      setLaunched(saved || { ...collection, ...chain });
      setPhase('success');
    } catch (e) {
      // The collection record and the issuer key survive, so the retry resumes
      // the on-chain steps instead of starting a second collection.
      setError(e?.message || 'The launch did not complete.');
      setPhase('review');
    } finally {
      setLaunching(false);
    }
  };

  const reset = () => {
    setForm(EMPTY);
    setEditionType('unique');
    setTotalSupply('10');
    setMintPrice('');
    setQuote('xlm');
    setRoyalty('');
    setMediaFile(null);
    setMediaPreview(null);
    setLaunched(null);
    setPhase('form');
    setProgressLabel('');
    setDraft(null);
    setError('');
    setAvailableXlm(null);
  };

  if (phase === 'launching') {
    return (
      <PageLayout title="Launch NFT" rightAction={<WalletButton />}>
        <div className="p-4 space-y-4">
          <LaunchTypeSwitch value="/launch-nft" />
          <div className="bg-[#141518] rounded-2xl p-6 flex flex-col items-center gap-3 text-center">
            <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
            <p className="text-sm font-bold">{progressLabel || 'Starting…'}</p>
            <p className="text-[10px] text-white/40">
              Approve each transaction in your wallet. Stellar Mainnet confirms in about five seconds.
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (phase === 'review') {
    return (
      <PageLayout title="Launch NFT" rightAction={<WalletButton />}>
        <div className="p-4 space-y-4">
          <LaunchTypeSwitch value="/launch-nft" />
          <NftLaunchReview
            name={form.name.trim()}
            symbol={form.symbol}
            supply={supply}
            price={price}
            quote={quote}
            cost={cost}
            availableXlm={availableXlm}
            error={error}
            retrying={!!draft}
            onConfirm={launch}
            onBack={() => setPhase('form')}
          />
        </div>
      </PageLayout>
    );
  }

  if (launched) {
    return (
      <PageLayout title="Launch NFT" rightAction={<WalletButton />}>
        <div className="p-4 space-y-4">
          <LaunchTypeSwitch value="/launch-nft" />

          <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check size={18} className="text-[#00ff88]" />
              <h3 className="text-sm font-bold">${launched.symbol} is live</h3>
            </div>
            <div className="flex items-center gap-3">
              {launched.media_url ? (
                <Image
                  src={launched.media_url}
                  fittingType="fill"
                  alt={launched.name}
                  className="w-16 h-16 rounded-xl border border-white/5"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{launched.name}</p>
                <p className="text-xs text-white/40">
                  {editionLabel(launched)} · {fmtMintPrice(launched)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#141518] rounded-2xl p-4 space-y-2">
            <div>
              <h3 className="text-sm font-bold">Metadata (IPFS compatible)</h3>
              <p className="text-[10px] text-white/30 mt-0.5">
                Saved with the collection and hosted at a permanent public URL, ready to pin to IPFS.
              </p>
            </div>
            <pre className="text-[10px] leading-relaxed text-white/50 bg-black/30 rounded-xl p-3 overflow-auto max-h-64">
              {launched.metadata_json}
            </pre>
          </div>

          <div className="bg-[#141518] rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold">On Stellar Mainnet</h3>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Asset</span>
              <span className="font-mono">{launched.asset_code}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/40">Issuer</span>
              <span className="font-mono">
                {launched.issuer_public_key?.slice(0, 6)}…{launched.issuer_public_key?.slice(-6)}
              </span>
            </div>
            <p className="text-[10px] text-white/30">
              The edition size is sealed by the network — the issuer key was zeroed as the supply was issued, so
              no further pieces can ever exist. The whole edition now sits in one sell order at your mint price.
            </p>
            {launched.asset_code && launched.issuer_public_key && (
              <a
                href={explorerAssetUrl(launched)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00ff88] pt-1"
              >
                View the collection on Stellar Expert <ExternalLink size={12} />
              </a>
            )}
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm"
          >
            View NFT Drops
          </button>
          <button onClick={reset} className="w-full py-3.5 rounded-xl bg-white/5 font-bold text-sm">
            Launch another collection
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Launch NFT" rightAction={<WalletButton />}>
      <div className="p-4 space-y-4">
        <LaunchTypeSwitch value="/launch-nft" />
        <NftLaunchGuide />

        <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-bold">Collection Details</h3>
            <p className="text-[10px] text-white/30 mt-0.5">Name, ticker and the story behind the drop</p>
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Collection Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Neon Stellar Apes"
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
            />
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Symbol (3-8 chars)</label>
            <input
              value={form.symbol}
              onChange={(e) =>
                setForm({ ...form, symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX_SYMBOL) })
              }
              placeholder="e.g. NEONAPE"
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 font-mono"
            />
            {form.symbol.length > 0 && !symbolOk && (
              <p className="text-[10px] text-[#ff3b5c] mt-1">Between {MIN_SYMBOL} and {MAX_SYMBOL} characters.</p>
            )}
          </div>
          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Describe the collection…"
              rows={3}
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 resize-none"
            />
          </div>
        </div>

        <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-bold">Editions & Pricing</h3>
            <p className="text-[10px] text-white/30 mt-0.5">How many pieces exist, and what one costs to mint</p>
          </div>

          <OptionGroup
            label="Edition Type"
            options={EDITION_TYPES}
            isSelected={(opt) => editionType === opt.value}
            onSelect={(opt) => setEditionType(opt.value)}
          />

          {editionType === 'limited' && (
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Total Supply (max {MAX_SUPPLY.toLocaleString()})</label>
              <input
                type="number"
                min={2}
                max={MAX_SUPPLY}
                value={totalSupply}
                onChange={(e) => setTotalSupply(e.target.value)}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
              />
              <p className="text-[10px] text-white/30 mt-1">Minting stops automatically once every edition is taken.</p>
            </div>
          )}

          <OptionGroup
            label="Mint Currency"
            options={QUOTES}
            isSelected={(opt) => quote === opt.value}
            onSelect={(opt) => setQuote(opt.value)}
          />

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Mint Price ({quote.toUpperCase()} per NFT)</label>
            <input
              type="number"
              min={0}
              value={mintPrice}
              onChange={(e) => setMintPrice(e.target.value)}
              placeholder="e.g. 50"
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
            />
            {mintPrice !== '' && !priceOk && (
              <p className="text-[10px] text-[#ff3b5c] mt-1">
                On-chain launches need a price of at least {MIN_MINT_PRICE} {quote.toUpperCase()} per edition.
              </p>
            )}
            <p className="text-[10px] text-white/30 mt-1">
              This price becomes a live sell order on the Stellar DEX — collectors pay it directly to you.
            </p>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-1.5 block">Royalty % (optional)</label>
            <input
              type="number"
              min={0}
              max={50}
              value={royalty}
              onChange={(e) => setRoyalty(e.target.value)}
              placeholder="e.g. 5"
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
            />
            <p className="text-[10px] text-white/30 mt-1">Share of secondary sales paid to you, up to 50%.</p>
          </div>
        </div>

        <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
          <div>
            <h3 className="text-sm font-bold">Media & Metadata</h3>
            <p className="text-[10px] text-white/30 mt-0.5">
              The artwork, plus the metadata document built from this form
            </p>
          </div>
          <NftMediaUpload
            file={mediaFile}
            preview={mediaPreview}
            onSelect={(f, preview) => {
              setMediaFile(f);
              setMediaPreview(preview);
            }}
            onError={(message) => toast({ title: message, variant: 'destructive' })}
          />
        </div>

        <button
          onClick={review}
          disabled={!canLaunch}
          className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-40"
        >
          Review &amp; launch on Mainnet
        </button>
        {!wallet && <p className="text-center text-xs text-white/40">Connect your wallet to launch a collection.</p>}
      </div>
    </PageLayout>
  );
}