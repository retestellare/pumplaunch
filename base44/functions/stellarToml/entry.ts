// Public asset registry (SEP-1 stellar.toml).
//
// Every token and NFT collection this app has launched is rendered here, read
// straight from the database on each request — a newly created token or
// collection therefore appears in the registry immediately, with no file to
// maintain. The endpoint is deliberately public: Stellar wallets and explorers
// fetch it without an app account, so it uses the service role for the read.
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const HOME_DOMAIN = 'pumplaunch.app';
const ORG_NAME = 'Stellar Pump';
const ORG_DESCRIPTION =
  'Stellar Pump — launch and trade memecoins and NFT collections on the Stellar network, with real on-chain order books, pool trading and fair-launch bonding curves.';
const PAGE_SIZE = 500;
const MAX_PAGES = 10;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

function currencyBlock({ code, issuer, name, description, image, fixedNumber, nft }) {
  const lines = ['[[CURRENCIES]]'];
  lines.push(`code="${esc(code)}"`);
  lines.push(`issuer="${esc(issuer)}"`);
  if (name) lines.push(`name="${esc(name)}"`);
  if (description) lines.push(`desc="${esc(description)}"`);
  if (image) lines.push(`image="${esc(image)}"`);
  if (fixedNumber) {
    // A sealed edition: whole units only, and the supply can never grow.
    lines.push('display_decimals=0');
    lines.push(`fixed_number=${fixedNumber}`);
  }
  if (nft) {
    // SEP-1's marker for an NFT entry, so wallets and explorers file the
    // collection as an NFT rather than a fungible token.
    lines.push('anchor_asset_type="nft"');
  }
  return lines.join('\n');
}

async function loadAll(client, entityName, query) {
  const entity = client.entities[entityName];
  const records = [];
  let cursor;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await entity.filter(query, { sort: '-created_date', limit: PAGE_SIZE, cursor });
    records.push(...(result?.items || []));
    if (!result?.has_more || !result?.next_cursor) break;
    cursor = result.next_cursor;
  }
  return records;
}

function buildToml(tokens, collections) {
  const blocks = [];
  const seen = new Set();

  for (const token of tokens) {
    const code = token.asset_code || token.symbol;
    if (!code || !token.issuer) continue;
    const key = `${code}:${token.issuer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    blocks.push(
      currencyBlock({
        code,
        issuer: token.issuer,
        name: token.name || code,
        description: token.description,
        image: token.image_url,
      })
    );
  }

  for (const collection of collections) {
    // A collection recorded under either spelling still lists — its ticker may
    // sit in symbol and its issuing account in issuer — so no NFT is dropped.
    const code = collection.asset_code || collection.symbol;
    const issuer = collection.issuer_public_key || collection.issuer;
    if (!code || !issuer) continue;
    const key = `${code}:${issuer}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const editions =
      collection.edition_type === 'limited' ? Math.max(1, collection.total_supply || 1) : 1;
    blocks.push(
      currencyBlock({
        code,
        issuer,
        name: collection.name || code,
        description: collection.description,
        image: collection.media_url,
        fixedNumber: editions,
        nft: true,
      })
    );
  }

  const header = [
    '# stellar.toml — Stellar Pump asset registry',
    '# Generated from the app database on every request, so new tokens and NFT',
    '# collections are listed automatically.',
    '',
    '[DOCUMENTATION]',
    `ORG_NAME="${ORG_NAME}"`,
    `ORG_URL="https://${HOME_DOMAIN}"`,
    `ORG_DESCRIPTION="${esc(ORG_DESCRIPTION)}"`,
    'ORG_KEYWORDS="stellar, memecoin, nft, launchpad, xlm, dex"',
  ].join('\n');

  return `${header}\n\n${blocks.join('\n\n')}\n`;
}

export default async function (req) {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const base44 = createClientFromRequest(req);
    const [tokens, collections] = await Promise.all([
      loadAll(base44.asServiceRole, 'Token', {
        asset_code: { $exists: true },
        issuer: { $exists: true },
      }),
      loadAll(base44.asServiceRole, 'NftCollection', {
        $or: [{ issuer_public_key: { $exists: true } }, { issuer: { $exists: true } }],
      }),
    ]);

    return new Response(buildToml(tokens, collections), {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}