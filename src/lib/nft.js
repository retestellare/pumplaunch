// NFT collections: edition maths, IPFS-compatible metadata, and the mint step.
//
// Editions are capped by the collection itself. Minting re-reads the record
// straight from the database before claiming a piece, so the counter can never
// pass total_supply — and the collection flips to "sold_out" the moment the
// last edition is taken.
import { base44 } from '@/api/base44Client';

export const EDITION_TYPES = [
  { value: 'unique', label: '1/1 Unique', desc: 'A single one-of-one piece. Only ever one edition.' },
  { value: 'limited', label: 'Limited Supply', desc: 'A fixed number of editions, minted until they run out.' },
];

export const QUOTES = [
  { value: 'xlm', label: 'XLM', desc: 'Mint in Stellar Lumens' },
  { value: 'usdc', label: 'USDC', desc: 'Mint in USD Coin' },
];

export const MAX_SUPPLY = 1000000;

export function editionLabel(collection) {
  const total = Math.max(1, collection?.total_supply || 1);
  return collection?.edition_type === 'limited' ? `${total.toLocaleString()} editions` : '1/1 Unique';
}

export function fmtMintPrice(collection) {
  const price = parseFloat(collection?.mint_price) || 0;
  if (price <= 0) return 'Free mint';
  return `${price.toLocaleString()} ${(collection?.quote || 'xlm').toUpperCase()}`;
}

export function mintProgress(collection) {
  const total = Math.max(1, collection?.total_supply || 1);
  const minted = Math.min(total, collection?.minted_count || 0);
  return {
    minted,
    total,
    percent: Math.round((minted / total) * 100),
    soldOut: collection?.status === 'sold_out' || minted >= total,
  };
}

// The metadata document a marketplace expects: name, symbol, description, the
// media, the edition size and a traits array.
export function buildMetadata({ name, symbol, description, mediaUrl, totalSupply, editionType, royalty, mintPrice, quote }) {
  const attributes = [
    { trait_type: 'Edition Type', value: editionType === 'limited' ? 'Limited Supply' : '1/1 Unique' },
    { trait_type: 'Total Supply', value: totalSupply },
  ];
  if (mintPrice > 0) attributes.push({ trait_type: 'Mint Price', value: `${mintPrice} ${String(quote).toUpperCase()}` });
  if (royalty > 0) attributes.push({ trait_type: 'Royalty', value: `${royalty}%` });

  return {
    name,
    symbol: String(symbol).toUpperCase(),
    description: description || '',
    image_url: mediaUrl || '',
    total_supply: totalSupply,
    attributes,
  };
}

// Claims the next available edition. Returns { ok: false } when the collection
// is exhausted rather than letting the count run past the supply.
export async function mintEdition(collection) {
  const fresh = await base44.entities.NftCollection.get(collection.id);
  const total = Math.max(1, fresh.total_supply || 1);
  const minted = fresh.minted_count || 0;

  if (minted >= total) {
    if (fresh.status !== 'sold_out') {
      await base44.entities.NftCollection.update(fresh.id, { status: 'sold_out' });
    }
    return { ok: false, reason: 'sold_out', minted: total, total };
  }

  const next = minted + 1;
  const patch = { minted_count: next };
  if (next >= total) patch.status = 'sold_out';
  const updated = await base44.entities.NftCollection.update(fresh.id, patch);
  return { ok: true, collection: updated || { ...fresh, ...patch }, minted: next, total };
}