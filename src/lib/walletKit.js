import { StellarWalletsKit } from '@creit.tech/stellar-wallets-kit/sdk';
import { defaultModules } from '@creit.tech/stellar-wallets-kit/modules/utils';
import { WalletConnectModule } from '@creit.tech/stellar-wallets-kit/modules/wallet-connect';
import { Networks } from '@stellar/stellar-sdk';

const WC_PROJECT_ID = '0c8b27173f9a34e04c7eb45dbe2e33bb';

let initialized = false;

export function ensureKitInit() {
  if (initialized) return;
  StellarWalletsKit.init({
    modules: [
      ...defaultModules(),
      new WalletConnectModule({ projectId: WC_PROJECT_ID }),
    ],
    network: Networks.PUBLIC,
  });
  initialized = true;
}

export { StellarWalletsKit };