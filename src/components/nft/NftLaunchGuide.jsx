import { useState } from 'react';
import { ChevronDown, AlertTriangle, Info } from 'lucide-react';

const SECTIONS = [
  {
    title: 'What a collection is on Stellar',
    items: [
      'A collection is one Stellar asset, and every edition is one unit of it. The name, artwork and details live in a metadata document saved with it.',
      '1/1 Unique = a single one-of-one piece. Limited Supply = a fixed number of editions, minted until they run out.',
      'The edition size is sealed by the network at launch — the issuer key is locked in the same transaction that hands the supply to you, so the supply can never be increased later.',
    ],
  },
  {
    title: 'Editions & supply',
    items: [
      'Symbol: 3–8 letters and numbers. Supply: 1 for a 1/1, or 2 to 1,000,000 for a limited drop.',
      'Each mint claims the next edition. The moment the last one is taken, the collection flips to Sold Out on its own.',
      'The progress shown on the collection card is read from the network, not from a local counter.',
    ],
  },
  {
    title: 'Artwork & metadata',
    items: [
      'Upload the artwork (image, up to 10MB). It gets a permanent public URL so wallets and marketplaces can load it.',
      'The metadata document — name, symbol, description, image, edition size, plus traits for price and royalty — is built from this form and stored with the collection.',
      'Marketplaces read those fields, so a clear name and description help your drop display correctly.',
    ],
  },
  {
    title: 'Price and the primary sale',
    items: [
      'A mint price above 0 is required. The price becomes a single sell offer for the whole supply on the Stellar DEX.',
      'Minting is a real purchase: the buyer\u2019s wallet sends the price and receives the edition in one signed transaction, and the DEX pays you directly. Nothing is held by the app.',
      'Stellar prices to 7 decimals, so the offer holds the price you enter at that precision.',
    ],
  },
  {
    title: 'Royalty',
    items: [
      'The royalty % is written into the metadata and honored by marketplaces that support royalties.',
      'Stellar has no on-chain royalty enforcement, so treat it as a marketplace setting rather than a guarantee.',
    ],
  },
  {
    title: 'Costs to expect',
    items: [
      '~2 XLM issuer reserve (non-refundable), plus refundable reserves for the trustlines and the sale offer.',
      'Network fees are ~0.00001 XLM per operation. Launching and minting in USDC adds the USDC trustline.',
      'A first-time minter pays a small extra 0.5 XLM reserve for the collection trustline.',
      'The review screen lists every account, trustline and offer with the exact estimated total before you sign anything.',
    ],
  },
  {
    title: 'Common mistakes to avoid',
    items: [
      'Launching without a mint price — the primary sale needs a real price to sell editions.',
      'Choosing a supply far larger than your audience: unsold editions simply stay in your wallet.',
      'Uploading artwork that is not final — the art and metadata are fixed at launch.',
      'Skipping the review screen, which is your last look at what goes on-chain.',
    ],
  },
];

export default function NftLaunchGuide() {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-[#141518] rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <span className="flex items-center gap-2 text-sm font-bold">
          <Info size={16} className="text-[#00ff88]" />
          NFT &amp; launch guide
        </span>
        <ChevronDown
          size={18}
          className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3">
          {SECTIONS.map((s) => (
            <div key={s.title}>
              <p className="text-xs font-bold text-white/80 mb-1">{s.title}</p>
              <ul className="space-y-1">
                {s.items.map((it, i) => (
                  <li key={i} className="flex gap-2 text-xs text-white/50">
                    <span className="text-[#00ff88] mt-0.5">•</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex items-start gap-2 bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-xl p-2.5">
            <AlertTriangle size={14} className="text-[#ff3b5c] mt-0.5 shrink-0" />
            <p className="text-[11px] text-white/60">
              This is a real Stellar mainnet launch with real XLM — once editions are live they cannot be edited or recalled.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}