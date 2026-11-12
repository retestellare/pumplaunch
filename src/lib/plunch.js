import * as StellarSdk from '@stellar/stellar-sdk';
import { BASE_FEE, NETWORK_PASSPHRASE, loadAccount, signAndSubmit } from '@/lib/stellar';

export const PLUNCH_CODE = 'PLUNCH';
export const PLUNCH_ISSUER = 'GC37N3TEZDIXDIGZC4PYM2ZTWE5ASWDDJGGXIPWLBGNMFROOBFF5MP2D';
export const PLUNCH_ASSET = new StellarSdk.Asset(PLUNCH_CODE, PLUNCH_ISSUER);

function holdsPlunchLine(account) {
  return (account?.balances || []).some(
    (line) => line.asset_code === PLUNCH_CODE && line.asset_issuer === PLUNCH_ISSUER
  );
}

// One wallet approval that only opens the PLUNCH line. The payout then goes out
// as a plain payment into it, so the wallet never shows a pending balance the
// member would have to claim afterwards.
export async function openPlunchTrustline(walletAddress) {
  const account = await loadAccount(walletAddress);
  if (!account) throw new Error('This wallet has no activity on Stellar mainnet yet.');
  if (holdsPlunchLine(account)) return { opened: false };

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: PLUNCH_ASSET }))
    .setTimeout(180)
    .build();

  const result = await signAndSubmit(tx);
  return { opened: true, hash: result?.hash || '' };
}

// The new line reaches Horizon a moment after the wallet signs. The payout is
// only asked for once it is readable, so the payment cannot be rejected for a
// line that is still in flight.
export async function waitForPlunchLine(walletAddress) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const account = await loadAccount(walletAddress);
    if (holdsPlunchLine(account)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return false;
}

// One wallet approval: the same envelope opens the PLUNCH trustline and claims the
// drop the faucet has parked for this wallet, so the tokens land as it lands.
export async function claimDropWithTrustline({ walletAddress, balanceId }) {
  const account = await loadAccount(walletAddress);
  if (!account) throw new Error('This wallet has no activity on Stellar mainnet yet.');

  const holdsLine = holdsPlunchLine(account);

  const builder = new StellarSdk.TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  // The line is opened only when it is missing, so this one approval works the same
  // for a wallet that already holds PLUNCH and one that does not.
  if (!holdsLine) builder.addOperation(StellarSdk.Operation.changeTrust({ asset: PLUNCH_ASSET }));
  builder.addOperation(StellarSdk.Operation.claimClaimableBalance({ balanceId }));

  return signAndSubmit(builder.setTimeout(180).build());
}