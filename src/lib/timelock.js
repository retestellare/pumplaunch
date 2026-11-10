import * as StellarSdk from '@stellar/stellar-sdk';
import { BASE_FEE, NETWORK_PASSPHRASE, bytesToHex, poolShareInfo } from '@/lib/stellar';
import { StellarWalletsKit, ensureKitInit } from '@/lib/walletKit';

// ─────────────────────────────────────────────────────────────────────────────
// Soroban timelock integration.
//
// The lock itself is enforced by the deployed contract, never by this app: the
// creator hands the pool-share amount to the contract with an unlock timestamp,
// and the contract refuses every release before that instant. Until a real
// address is pasted below the app refuses to submit, so nothing pretends to be
// locked when it is not.
//
// The contract is called with (OpenZeppelin TimelockController style):
//   create_lock(owner: Address, pool_id: BytesN<32>, amount: i128, unlock_at: u64)
//   release(owner: Address, pool_id: BytesN<32>)            // allowed at unlock_at
//   get_lock(owner: Address, pool_id: BytesN<32>) -> Option<LockInfo>
// If the deployed contract names these differently, change them here only.
// ─────────────────────────────────────────────────────────────────────────────
export const TIMELOCK_CONTRACT_ID = 'CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
const HORIZON_URL = 'https://horizon.stellar.org';
const SOROBAN_RPC_URL = 'https://soroban-rpc.mainnet.stellar.gateway.fm';

export const TIMELOCK_METHOD = {
  create: 'create_lock',
  release: 'release',
  read: 'get_lock',
};

export const LOCK_PRESETS = [
  { days: 30, label: '30 days', hint: 'One month' },
  { days: 90, label: '90 days', hint: 'Three months' },
  { days: 180, label: '180 days', hint: 'Six months' },
  { days: 365, label: '365 days', hint: 'One year' },
];

export const LOCK_PERCENT_CHOICES = [
  { value: 50, label: '50% locked', hint: 'Half the pool shares' },
  { value: 100, label: '100% locked', hint: 'Every pool share' },
];

// A placeholder is not a contract: an invalid address must stop the launch
// instead of sending shares nowhere.
export function isTimelockConfigured() {
  try {
    return StellarSdk.StrKey.isValidContract(TIMELOCK_CONTRACT_ID);
  } catch {
    return false;
  }
}

let soroban = null;
function sorobanServer() {
  if (!soroban) soroban = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);
  return soroban;
}

// The unlock instant is counted from the last closed ledger, not from the
// device clock, so a wrong phone time cannot shorten somebody's lock.
let clock = { at: 0, time: 0 };
export async function fetchLedgerTime() {
  if (clock.time && Date.now() - clock.at < 30 * 1000) return clock.time;

  let time = 0;
  try {
    const latest = await sorobanServer().getLatestLedger();
    if (latest?.closeTime) time = Math.floor(Number(latest.closeTime));
  } catch {
    time = 0;
  }
  if (!time) {
    const ledger = await new StellarSdk.Horizon.Server(HORIZON_URL).ledgers().order('desc').limit(1).call();
    const closedAt = ledger?.records?.[0]?.closed_at;
    if (closedAt) time = Math.floor(new Date(closedAt).getTime() / 1000);
  }
  if (!time) throw new Error('The Stellar network time could not be read. Try again in a moment.');

  clock = { at: Date.now(), time };
  return time;
}

// Unix seconds the contract unlocks at. Ledgers close about every 5 seconds,
// so the real unlock is that timestamp plus at most a ledger of drift.
export function unlockFrom(ledgerTime, days) {
  const span = Math.max(1, Number(days) || 0) * 24 * 60 * 60;
  return Math.floor(ledgerTime + span);
}

// The 32-byte id of the pool whose shares are being locked.
export function poolIdFor(assetCode, issuer, quote = 'xlm') {
  const { poolAsset } = poolShareInfo(assetCode, issuer, quote);
  return bytesToHex(StellarSdk.getLiquidityPoolId('constant_product', poolAsset.getLiquidityPoolParameters()));
}

// What the creator chose, priced against the shares actually held after the
// deposit landed: the amount locked is a share of the minted pool shares.
export function planTimelock({ percent = 50, days = 30, ledgerTime = 0, poolShares = 0 }) {
  const lockPercent = Number(percent) >= 100 ? 100 : 50;
  const unlockAt = ledgerTime ? unlockFrom(ledgerTime, days) : 0;
  const total = Number(poolShares) || 0;
  const shares = total > 0 ? total * (lockPercent / 100) : 0;
  return { percent: lockPercent, days, unlockAt, shares, total, ready: !!unlockAt };
}

function addressArg(address) {
  return new StellarSdk.Address(address).toScVal();
}

function poolArg(poolId) {
  const bytes = Uint8Array.from(String(poolId).match(/.{2}/g) || [], (pair) => parseInt(pair, 16));
  return StellarSdk.xdr.ScVal.scvBytes(bytes);
}

function amountArg(amount) {
  return StellarSdk.nativeToScVal(BigInt(Math.floor(amount)), { type: 'i128' });
}

function timeArg(seconds) {
  return StellarSdk.nativeToScVal(BigInt(Math.floor(seconds)), { type: 'u64' });
}

async function pollResult(hash) {
  const server = sorobanServer();
  for (let i = 0; i < 20; i += 1) {
    const result = await server.getTransaction(hash);
    if (result.status === 'SUCCESS') return result;
    if (result.status === 'FAILED') {
      throw new Error('The timelock contract rejected the lock, so nothing was locked.');
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`The timelock transaction (${hash}) is still confirming. Resume in a moment to finish.`);
}

// One wallet approval: the pool shares go to the contract with the unlock time.
// Simulated first, so an argument the contract will not accept fails before the
// creator signs anything.
export async function lockSharesInTimelock({ walletAddress, poolId, shares, unlockAt }) {
  if (!isTimelockConfigured()) {
    throw new Error('The timelock contract address is not configured yet, so nothing was locked.');
  }
  if (!(shares > 0)) throw new Error('There are no pool shares to lock yet.');
  if (!(unlockAt > 0)) throw new Error('The unlock date is missing.');

  const server = sorobanServer();
  const contract = new StellarSdk.Contract(TIMELOCK_CONTRACT_ID);
  const account = await server.getAccount(walletAddress);

  const call = contract.call(
    TIMELOCK_METHOD.create,
    addressArg(walletAddress),
    poolArg(poolId),
    amountArg(shares),
    timeArg(unlockAt)
  );

  const built = new StellarSdk.TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(call)
    .setTimeout(180)
    .build();

  const prepared = await server.prepareTransaction(built);

  ensureKitInit();
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(prepared.toXDR(), {
    address: walletAddress,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signed = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const sent = await server.sendTransaction(signed);
  if (sent?.status === 'ERROR') {
    throw new Error('The network refused the timelock transaction. Nothing was locked.');
  }

  const confirmed = await pollResult(sent.hash);
  return { txHash: sent.hash, ledger: confirmed.ledger, unlockAt, shares };
}

export function formatUnlockDate(unixSeconds) {
  if (!unixSeconds) return '—';
  return new Date(Number(unixSeconds) * 1000).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// "89d 12h 04m 11s" — a long lock reads better in days than in hours.
export function formatRemaining(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}