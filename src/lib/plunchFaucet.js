import * as StellarSdk from '@stellar/stellar-sdk';
import { StellarWalletsKit, ensureKitInit } from './walletKit';
import { NETWORK_PASSPHRASE, StellarError } from './stellar';

// The faucet lives in a contract that holds the PLUNCH pool itself: nothing has
// to sign on the faucet's behalf, so no app server is involved. Paste the
// contract address returned by the one-time deploy here.
export const FAUCET_CONTRACT_ID = '';

export const PLUNCH_CODE = 'PLUNCH';
export const PLUNCH_ISSUER = 'GC37N3TEZDIXDIGZC4PYM2ZTWE5ASWDDJGGXIPWLBGNMFROOBFF5MP2D';
export const FAUCET_REWARD = 90000;

const RPC_URL = 'https://soroban-rpc.mainnet.stellar.gateway.fm';

const rpc = new StellarSdk.rpc.Server(RPC_URL);

export function faucetDeployed() {
  return !!FAUCET_CONTRACT_ID && StellarSdk.StrKey.isValidContract(FAUCET_CONTRACT_ID);
}

function faucetContract() {
  return new StellarSdk.Contract(FAUCET_CONTRACT_ID);
}

function userAddress(address) {
  return StellarSdk.nativeToScVal(address, { type: 'address' });
}

// A read-only call: simulated, never submitted.
async function simulateCall(address, method) {
  const account = await rpc.getAccount(address);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(faucetContract().call(method, userAddress(address)))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (sim.error || !sim.result?.retval) {
    throw new StellarError('The faucet contract did not answer.', 'faucet_call');
  }
  return StellarSdk.scValToNative(sim.result.retval);
}

// When this wallet may claim again, read from the contract's own counter.
export async function fetchNextClaim(address) {
  return Number(await simulateCall(address, 'next_claim'));
}

// The wallet signs its own claim; the contract moves PLUNCH out of its balance.
export async function claimPlunch(address) {
  const account = await rpc.getAccount(address);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '200000',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(faucetContract().call('claim', userAddress(address)))
    .setTimeout(120)
    .build();

  const prepared = await rpc.prepareTransaction(tx);
  ensureKitInit();
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(prepared.toXDR(), {
    address,
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  const signed = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, NETWORK_PASSPHRASE);
  const sent = await rpc.sendTransaction(signed);
  if (sent.status === 'ERROR') {
    throw new StellarError('The faucet refused that claim — try again in a moment.', 'faucet_claim');
  }

  const final = await rpc.pollTransaction(sent.hash, { attempts: 30 });
  if (final.status !== 'SUCCESS') {
    throw new StellarError('The claim did not confirm on the network.', 'faucet_claim');
  }
  return { hash: sent.hash };
}