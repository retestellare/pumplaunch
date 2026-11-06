import * as StellarSdk from '@stellar/stellar-sdk';
import { BASE_FEE, NETWORK_PASSPHRASE, loadAccount, signAndSubmit } from '@/lib/stellar';

export const PLUNCH_CODE = 'PLUNCH';
export const PLUNCH_ISSUER = 'GC37N3TEZDIXDIGZC4PYM2ZTWE5ASWDDJGGXIPWLBGNMFROOBFF5MP2D';
export const PLUNCH_ASSET = new StellarSdk.Asset(PLUNCH_CODE, PLUNCH_ISSUER);

// One wallet approval: the same envelope opens the PLUNCH trustline and claims the
// drop the faucet has parked for this wallet, so the tokens land as it lands.
export async function claimDropWithTrustline({ walletAddress, balanceId }) {
  const account = await loadAccount(walletAddress);
  if (!account) throw new Error('This wallet has no activity on Stellar mainnet yet.');

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: PLUNCH_ASSET }))
    .addOperation(StellarSdk.Operation.claimClaimableBalance({ balanceId }))
    .setTimeout(180)
    .build();

  return signAndSubmit(transaction);
}