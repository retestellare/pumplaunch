import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { WalletConnectModule } from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';
import { Networks } from '@stellar/stellar-sdk';
import { MASCOT_IMAGE } from './brandAssets';

const WC_PROJECT_ID = '0c8b27173f9a34e04c7eb45dbe2e33bb';
const FALLBACK_URL = 'https://stellarlaunch.base44.app';

// WalletConnect REQUIRES the dApp metadata on every session proposal: it is what
// the wallet app shows and what it approves. Without it the request reaches the
// wallet and can never be accepted, which is what left the connect sheet hanging
// on "Continue in LOBSTR Wallet".
function dappMetadata() {
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : FALLBACK_URL;
  return {
    name: 'Stellar Pump',
    description: 'Launch and trade memecoins on the Stellar DEX.',
    url: origin,
    icons: [MASCOT_IMAGE],
    // Where the wallet hands control back to after approving.
    redirect: { universal: origin },
  };
}

let initialized = false;

export function ensureKitInit() {
  if (initialized) return;
  const metadata = dappMetadata();
  const modules = defaultModules();
  try {
    modules.push(
      new WalletConnectModule({
        projectId: WC_PROJECT_ID,
        metadata,
        appKitOptions: { metadata, enableAnalytics: false },
      })
    );
  } catch {
    // A broken WalletConnect setup must not take the other wallets down with it.
  }
  StellarWalletsKit.init({ modules, network: Networks.PUBLIC });
  initialized = true;
}

export { StellarWalletsKit };