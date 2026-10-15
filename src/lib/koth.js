import { base44 } from '@/api/base44Client';
import { StellarSdk, BASE_FEE, NETWORK_PASSPHRASE, loadAccount, signAndSubmit } from './stellar';

// Every King of the Hill call goes through one backend function: it holds the
// platform wallet and reads the chain itself, so this side only prepares and
// reports the payment.
async function invoke(payload) {
  try {
    const res = await base44.functions.invoke('kothChallenge', payload);
    return res.data;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || 'King of the Hill request failed');
  }
}

export function fetchKothConfig() {
  return invoke({ action: 'config' });
}

export function createChallenge({ walletAddress, tokenId, amountXlm }) {
  return invoke({
    action: 'challenge',
    wallet_address: walletAddress,
    token_id: tokenId,
    amount_xlm: amountXlm,
  });
}

export function verifyChallenge({ challengeId, txHash }) {
  return invoke({ action: 'verify', challenge_id: challengeId, tx_hash: txHash });
}

// The stake is one direct XLM payment; the challenge memo rides along with it and
// is what ties the payment to the token being nominated.
export function buildStakeTransaction({ sourceAccount, destination, amountXlm, memo }) {
  const tx = new StellarSdk.TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
    memo: StellarSdk.Memo.text(memo),
  });
  tx.addOperation(
    StellarSdk.Operation.payment({
      destination,
      asset: StellarSdk.Asset.native(),
      amount: Number(amountXlm).toFixed(7),
    })
  );
  return tx.setTimeout(300).build();
}

async function sendStake({ walletAddress, destination, amountXlm, memo }) {
  const account = await loadAccount(walletAddress);
  if (!account) throw new Error('Your wallet account was not found on the network.');
  const tx = buildStakeTransaction({ sourceAccount: account, destination, amountXlm, memo });
  const result = await signAndSubmit(tx);
  return result.hash;
}

// Horizon can lag a few seconds behind the wallet's own confirmation, so the
// verdict is re-checked until the chain reports it.
export async function submitStake({ challenge, walletAddress, amountXlm, onStep }) {
  onStep?.('signing');
  const hash = await sendStake({
    walletAddress,
    destination: challenge.destination,
    amountXlm,
    memo: challenge.memo,
  });

  onStep?.('verifying');
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await verifyChallenge({ challengeId: challenge.id, txHash: hash });
    if (res?.status && res.status !== 'pending') return { ...res, hash };
    await new Promise((r) => setTimeout(r, 3000));
  }
  return { status: 'pending', hash };
}

export function reignLabel(from) {
  if (!from) return '—';
  const mins = Math.floor((Date.now() - new Date(from).getTime()) / 60000);
  if (mins < 1) return 'just crowned';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}