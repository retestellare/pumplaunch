// Secondary market for NFT collections.
//
// A collection is a single Stellar asset and every edition is one unit of it, so
// editions trade exactly like a token does: the creator's original sale offer and
// any holder's listing are asks on the Stellar DEX, and a buyer fills them with
// one signed payment. A secondary sale only moves units between wallets — the
// edition cap sealed at launch is never touched.
import {
  loadAccount,
  parseBalances,
  hasTrustline,
  fetchOrderBook,
  fetchOpenOrders,
  buildBuyTransaction,
  buildLimitSellTransaction,
  buildCancelOfferTransaction,
  signAndSubmit,
} from '@/lib/stellar';
import { USDC_CODE, USDC_ISSUER } from '@/lib/pools';
import { syncCollectionMinted } from '@/lib/nftLaunch';

const RESERVE_PER_ENTRY = 0.5;
const DECIMALS = 1e7;
// Editions are whole by design, but an offer can hold a fraction of one after a
// partial fill, so amounts compare with a tolerance instead of exactly.
const EPSILON = 1e-9;

function lineBalance(account, assetCode, issuer) {
  const line = (account?.balances || []).find(
    (b) => b.asset_code === assetCode && b.asset_issuer === issuer
  );
  return line ? parseFloat(line.balance) || 0 : 0;
}

// Everything a buyer and a seller need, read in one go: the ask ladder a purchase
// walks, the best bid, and what this wallet holds or has listed.
export async function fetchNftMarket(collection, { address } = {}) {
  const quote = collection.quote || 'xlm';
  const [book, account, orders] = await Promise.all([
    fetchOrderBook(collection.asset_code, collection.issuer_public_key, quote),
    address ? loadAccount(address).catch(() => null) : null,
    address
      ? fetchOpenOrders(address, collection.asset_code, collection.issuer_public_key).catch(() => [])
      : [],
  ]);

  const asks = book?.asks || [];
  const bids = book?.bids || [];
  const availableXlm = account ? parseBalances(account).availableXlm : 0;

  return {
    quote,
    asks,
    bids,
    floor: book?.bestAsk || 0,
    bestBid: book?.bestBid || 0,
    listed: asks.reduce((sum, level) => sum + level.amount, 0),
    listings: asks.length,
    availableXlm,
    usdc: quote === 'usdc' ? lineBalance(account, USDC_CODE, USDC_ISSUER) : 0,
    usdcTrustline: hasTrustline(account, USDC_CODE, USDC_ISSUER),
    collectionTrustline: hasTrustline(account, collection.asset_code, collection.issuer_public_key),
    held: lineBalance(account, collection.asset_code, collection.issuer_public_key),
    myListings: orders.filter((o) => o.side === 'sell'),
  };
}

// What buying `quantity` editions costs, walking the asks cheapest first so the
// quote reflects the offers that can actually fill it.
export function estimateBuy(market, quantity) {
  const qty = Math.max(0, Number(quantity) || 0);
  let left = qty;
  let cost = 0;
  const levels = [];

  for (const level of market?.asks || []) {
    if (left <= EPSILON) break;
    const take = Math.min(left, level.amount);
    cost += take * level.price;
    left -= take;
    levels.push({ price: level.price, amount: take });
  }

  const filled = qty - Math.max(0, left);
  return {
    quantity: qty,
    filled,
    shortfall: Math.max(0, left),
    enough: qty > 0 && left <= EPSILON,
    cost,
    avgPrice: filled > 0 ? cost / filled : 0,
    levels,
  };
}

// One wallet approval pays the listing holders directly and delivers the editions
// to the buyer; their trustline is created in the same transaction when it is the
// first edition they own.
export async function buyEditions({ address, collection, quantity, maxCost }) {
  const account = await loadAccount(address);
  if (!account) throw new Error('This wallet has no XLM on Stellar Mainnet yet.');

  // Offers hold 7-decimal prices, so paying a hair above the quoted cost keeps the
  // fill at the size the ladder predicted.
  const payAmount = Math.ceil((Number(maxCost) || 0) * DECIMALS) / DECIMALS;
  const tx = buildBuyTransaction({
    sourceAccount: account,
    assetCode: collection.asset_code,
    issuer: collection.issuer_public_key,
    quote: collection.quote || 'xlm',
    amount: payAmount,
    minTokensOut: quantity,
  });
  const result = await signAndSubmit(tx);
  // Buying off the creator's own sale offer is a mint, so the counter is re-read
  // from the network either way and can never drift.
  const synced = await syncCollectionMinted(collection);
  return { result, collection: synced || collection };
}

// Listing is a plain sell offer: the editions stay in the seller's wallet until a
// buyer fills the offer.
export async function listEditions({ address, collection, quantity, price }) {
  const account = await loadAccount(address);
  if (!account) throw new Error('This wallet has no XLM on Stellar Mainnet yet.');
  const tx = buildLimitSellTransaction({
    sourceAccount: account,
    assetCode: collection.asset_code,
    issuer: collection.issuer_public_key,
    quote: collection.quote || 'xlm',
    tokenAmount: quantity,
    triggerPrice: price,
  });
  return signAndSubmit(tx);
}

export async function cancelListing({ address, collection, offer }) {
  const account = await loadAccount(address);
  if (!account) throw new Error('This wallet has no XLM on Stellar Mainnet yet.');
  const tx = buildCancelOfferTransaction({
    sourceAccount: account,
    side: 'sell',
    assetCode: collection.asset_code,
    issuer: collection.issuer_public_key,
    quote: collection.quote || 'xlm',
    offerId: offer.offerId,
    price: offer.price,
  });
  return signAndSubmit(tx);
}

// A buy locks a trustline reserve when the wallet has never held the collection;
// a listing locks the offer's own 0.5 XLM subentry while it stays open.
export function estimateNftCost(side, { market, collection } = {}) {
  const usdcLine = (collection?.quote || 'xlm') === 'usdc' && !market?.usdcTrustline;

  if (side === 'buy') {
    const collectionLine = !market?.collectionTrustline;
    const operations = 1 + (collectionLine ? 1 : 0) + (usdcLine ? 1 : 0);
    return {
      feeXlm: (operations * 100) / 1e7,
      reserveXlm: (collectionLine ? RESERVE_PER_ENTRY : 0) + (usdcLine ? RESERVE_PER_ENTRY : 0),
      offerLockXlm: 0,
    };
  }

  const operations = 1 + (usdcLine ? 1 : 0);
  return {
    feeXlm: (operations * 100) / 1e7,
    reserveXlm: usdcLine ? RESERVE_PER_ENTRY : 0,
    offerLockXlm: RESERVE_PER_ENTRY,
  };
}