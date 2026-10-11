// Real Stellar Mainnet issuance for NFT collections.
//
// A collection is one Stellar asset and every edition is a unit of it. The issuer
// account's master key is zeroed in the same transaction that hands the whole
// supply to the creator, so the edition size is sealed by the network itself —
// not by this app. The primary sale is a single sell offer on the Stellar DEX at
// the mint price, which makes a mint a real purchase: the buyer's wallet sends
// the price and receives the edition in one signed transaction, and the DEX pays
// the creator directly.
import { base44 } from '@/api/base44Client';
import {
  StellarSdk,
  loadAccount,
  hasTrustline,
  fetchOpenOrders,
  buildLaunchSetupTransaction,
  buildIssuerSetupTransaction,
  buildLimitSellTransaction,
  buildBuyTransaction,
  signAndSubmit,
  submitProgrammatically,
  pollForAccount,
  keypairFromSecret,
  HOME_DOMAIN,
} from '@/lib/stellar';
import { USDC_CODE, USDC_ISSUER } from '@/lib/pools';
import { getIssuerSecret, setIssuerSecret } from '@/lib/launchAttempts';
import { mintEdition } from '@/lib/nft';

const RESERVE_PER_ENTRY = 0.5;
const ISSUER_RESERVE_XLM = 2;
const DECIMALS = 1e7;

// Stellar's smallest priceable amount: anything below this cannot sit in an offer.
export const MIN_MINT_PRICE = 0.0000001;

export function isOnChain(collection) {
  return !!(collection?.asset_code && collection?.issuer_public_key);
}

export function explorerAssetUrl(collection) {
  return `https://stellar.expert/explorer/public/asset/${collection.asset_code}-${collection.issuer_public_key}`;
}

// Three transactions: issuer account + creator trustline, the sealed issuance,
// and the DEX sale.
export function estimateCollectionLaunchCost({ quote = 'xlm' } = {}) {
  const usdcTrustline = quote === 'usdc';
  const operations = 5 + (usdcTrustline ? 1 : 0);
  return {
    operations,
    feeXlm: (operations * 100) / 1e7,
    reserveXlm: ISSUER_RESERVE_XLM + (usdcTrustline ? 3 : 2) * RESERVE_PER_ENTRY,
  };
}

// One signed transaction, plus whatever reserve a first-time buyer must lock.
export function estimateMintCost({ account, collection }) {
  const collectionLine = !hasTrustline(account, collection.asset_code, collection.issuer_public_key);
  const usdcLine = collection.quote === 'usdc' && !hasTrustline(account, USDC_CODE, USDC_ISSUER);
  const operations = 1 + (collectionLine ? 1 : 0) + (usdcLine ? 1 : 0);
  return {
    operations,
    feeXlm: (operations * 100) / 1e7,
    reserveXlm: (collectionLine ? RESERVE_PER_ENTRY : 0) + (usdcLine ? RESERVE_PER_ENTRY : 0),
    newCollectionTrustline: collectionLine,
  };
}

function balanceOf(account, assetCode, issuer) {
  const line = (account?.balances || []).find(
    (b) => b.asset_code === assetCode && b.asset_issuer === issuer
  );
  return line ? parseFloat(line.balance) || 0 : 0;
}

// The creator's sell offer IS the primary market, so what it still holds is the
// number of unminted editions.
export async function fetchCollectionState(collection) {
  if (!isOnChain(collection)) return null;
  const total = Math.max(1, collection.total_supply || 1);
  const orders = await fetchOpenOrders(collection.creator, collection.asset_code, collection.issuer_public_key);
  const sale = orders.find((o) => o.side === 'sell') || null;

  if (!sale) {
    return { minted: Math.min(total, collection.minted_count || 0), remaining: 0, soldOut: false, onSale: false };
  }

  const remaining = Math.max(0, Math.min(total, sale.amount));
  return { minted: total - remaining, remaining, soldOut: remaining <= 0, onSale: true, offerId: sale.offerId };
}

// Each step is guarded by what the network already shows, so re-running a
// half-finished launch picks up exactly where it stopped instead of duplicating
// accounts or offers.
export async function launchCollectionOnChain({
  address,
  symbol,
  supply,
  price,
  quote = 'xlm',
  homeDomain = HOME_DOMAIN,
  onStep = () => {},
}) {
  const assetCode = String(symbol).toUpperCase();
  const storedSecret = getIssuerSecret(address, symbol);
  const issuerKeypair = storedSecret ? keypairFromSecret(storedSecret) : StellarSdk.Keypair.random();
  const issuerPublicKey = issuerKeypair.publicKey();
  setIssuerSecret(address, symbol, issuerKeypair.secret());

  const creator = await loadAccount(address);
  if (!creator) throw new Error('This wallet has no XLM on Stellar Mainnet yet.');

  // 1 — the collection's issuer account and the creator's trustline to it.
  if (!(await loadAccount(issuerPublicKey))) {
    onStep('Creating the collection issuer on Mainnet…');
    const { transaction } = buildLaunchSetupTransaction({
      sourceAccount: creator,
      assetCode,
      homeDomain,
      issuerKeypair,
    });
    await signAndSubmit(transaction);
    await pollForAccount(issuerPublicKey);
  }

  // 2 — seal the edition size forever, then hand the whole supply to the creator.
  let creatorAccount = await loadAccount(address);
  if (balanceOf(creatorAccount, assetCode, issuerPublicKey) <= 0) {
    onStep('Sealing the edition size and issuing your editions…');
    const issuerAccount = await pollForAccount(issuerPublicKey);
    const issuance = buildIssuerSetupTransaction({
      issuerAccount,
      userAddress: address,
      assetCode,
      totalSupply: supply,
      homeDomain,
    });
    await submitProgrammatically(issuance, issuerKeypair);
    creatorAccount = await loadAccount(address);
  }

  // 3 — the primary sale: every edition escrowed in one DEX sell order.
  const orders = await fetchOpenOrders(address, assetCode, issuerPublicKey);
  const openSale = orders.find((o) => o.side === 'sell');
  if (openSale) return { assetCode, issuerPublicKey, homeDomain, offerId: openSale.offerId };

  onStep('Opening the primary sale on the Stellar DEX…');
  creatorAccount = await loadAccount(address);
  const sale = buildLimitSellTransaction({
    sourceAccount: creatorAccount,
    assetCode,
    issuer: issuerPublicKey,
    quote,
    tokenAmount: supply,
    triggerPrice: price,
  });
  await signAndSubmit(sale);

  return { assetCode, issuerPublicKey, homeDomain };
}

// A mint is the buyer buying one edition off the sale offer: one wallet approval
// pays the creator and delivers the piece. The counter is then re-read from the
// network so the app can never claim more editions than exist.
export async function mintEditionOnChain({ address, collection }) {
  const account = await loadAccount(address);
  if (!account) throw new Error('This wallet has no XLM on Stellar Mainnet yet.');

  // Offers hold 7-decimal prices, so paying a hair above the listed price keeps
  // the fill at exactly one edition.
  const payAmount = Math.ceil((collection.mint_price || 0) * DECIMALS) / DECIMALS;
  const purchase = buildBuyTransaction({
    sourceAccount: account,
    assetCode: collection.asset_code,
    issuer: collection.issuer_public_key,
    quote: collection.quote || 'xlm',
    amount: payAmount,
    minTokensOut: 1,
  });

  return signAndSubmit(purchase);
}

// The creator's sale offer is the primary market, so the network is the source of
// truth for how many editions are left: the counter is re-read from it after any
// purchase and can never drift from what is really on sale.
export async function syncCollectionMinted(collection, claimed = 0) {
  try {
    const state = await fetchCollectionState(collection);
    const total = Math.max(1, collection.total_supply || 1);
    const minted = Math.min(total, Math.max(claimed, collection.minted_count || 0, state?.minted || 0));
    const patch = { minted_count: minted };
    if (minted >= total) patch.status = 'sold_out';
    return await base44.entities.NftCollection.update(collection.id, patch);
  } catch {
    return null;
  }
}

export async function mintNft({ address, collection }) {
  await mintEditionOnChain({ address, collection });
  const claim = await mintEdition(collection);
  const synced = await syncCollectionMinted(collection, claim.minted);
  return {
    ok: true,
    minted: synced?.minted_count ?? claim.minted,
    total: claim.total,
    collection: synced || claim.collection || collection,
  };
}