import { base44 } from '@/api/base44Client';
import { tokenPools } from '@/lib/pools';

// The published asset registry (SEP-1 stellar.toml) is rendered from this app's
// database on every request, so a saved edit is served immediately. The copy
// wallets fetch at /.well-known/stellar.toml is rebuilt from the same source on
// every app publish.
export const REGISTRY_ENDPOINT = 'https://stellarlaunch.base44.app/functions/stellarToml';
export const REGISTRY_LABEL = 'stellarlaunch.base44.app/functions/stellarToml';
export const REGISTRY_FILE = 'pumplaunch.app/.well-known/stellar.toml';

export const TOKEN = 'token';
export const COLLECTION = 'collection';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

export function entityFor(kind) {
  return kind === COLLECTION ? base44.entities.NftCollection : base44.entities.Token;
}

export function assetCode(record) {
  return record?.asset_code || record?.symbol || '';
}

// Older records may carry the issuing account under the other spelling, so both
// are read: a collection is never left out of the registry for it.
export function assetIssuer(record, kind) {
  const primary = kind === COLLECTION ? record?.issuer_public_key : record?.issuer;
  const other = kind === COLLECTION ? record?.issuer : record?.issuer_public_key;
  return primary || other || '';
}

export function assetImage(record, kind) {
  return (kind === COLLECTION ? record?.media_url : record?.image_url) || '';
}

// The registry reads one set of fields per asset, and those are the ones the
// manager edits.
export function withRegistryFields(record, kind, { name, description, image }) {
  const imageField = kind === COLLECTION ? { media_url: image } : { image_url: image };
  return { ...record, name, description, ...imageField };
}

// A token only trades in the pools it launched with; a collection is simply
// probed against both quote assets.
export function marketQuotes(record, kind) {
  return kind === TOKEN ? tokenPools(record) : ['xlm', 'usdc'];
}

export function assetMeta(record, kind) {
  return {
    name: record?.name || assetCode(record),
    logo: assetImage(record, kind),
    homeDomain: record?.custom_domain || record?.home_domain || '',
  };
}

export function assetPath(kind, id) {
  return `/manage/${kind}/${id}`;
}

// The exact [[CURRENCIES]] entry the registry serves for this asset — the same
// rules the endpoint applies, so the preview is what wallets will read.
export function registryBlock(record, kind) {
  const code = assetCode(record);
  const issuer = assetIssuer(record, kind);
  if (!code || !issuer) return null;

  const lines = ['[[CURRENCIES]]', `code="${esc(code)}"`, `issuer="${esc(issuer)}"`];
  lines.push(`name="${esc(record?.name || code)}"`);
  if (record?.description) lines.push(`desc="${esc(record.description)}"`);
  const image = assetImage(record, kind);
  if (image) lines.push(`image="${esc(image)}"`);

  if (kind === COLLECTION) {
    // A collection is a sealed edition: whole units only, supply fixed.
    const editions = record?.edition_type === 'limited' ? Math.max(1, record?.total_supply || 1) : 1;
    lines.push('display_decimals=0');
    lines.push(`fixed_number=${editions}`);
    lines.push('anchor_asset_type="nft"');
  }
  return lines.join('\n');
}

// The registry document as it is served right now.
export async function fetchRegistryText() {
  const response = await fetch(`${REGISTRY_ENDPOINT}?t=${Date.now()}`);
  if (!response.ok) throw new Error(`The registry responded ${response.status}`);
  return response.text();
}

// This asset's own entry inside a served registry document, or null when the
// registry does not list it.
export function servedEntry(text, record, kind) {
  const code = assetCode(record);
  const issuer = assetIssuer(record, kind);
  if (!code || !issuer) return null;

  const match = String(text || '')
    .split('[[CURRENCIES]]')
    .slice(1)
    .find((block) => block.includes(`code="${code}"`) && block.includes(`issuer="${issuer}"`));

  return match ? `[[CURRENCIES]]${match}`.trim() : null;
}

// Saving these fields is what republishes the entry: the registry renders the
// record itself.
export async function saveRegistryFields(kind, id, fields) {
  const { name, description, image } = fields;
  const payload =
    kind === COLLECTION
      ? { name, description, media_url: image }
      : { name, description, image_url: image };
  return entityFor(kind).update(id, payload);
}

export async function loadCreatedAssets(address) {
  const [tokens, collections] = await Promise.all([
    base44.entities.Token.filter({ creator: address }, '-created_date', 100),
    base44.entities.NftCollection.filter({ creator: address }, '-created_date', 100),
  ]);
  return { tokens: tokens || [], collections: collections || [] };
}