import { base44 } from '@/api/base44Client';

// The promo launch is fixed: one XLM pool, 100% Auto-Pool, 5 XLM of initial
// liquidity. requiredXlm is what the launch needs in spendable XLM — the
// funding wallet tops the creator's wallet up to cover it.
export const FREE_LAUNCH = {
  liquidity: 5,
  requiredXlm: 8.01,
};

export async function freeLaunchStatus(walletAddress) {
  const res = await base44.functions.invoke('freeLaunch', {
    action: 'status',
    wallet_address: walletAddress,
  });
  return res.data;
}

export async function fundFreeLaunch(walletAddress) {
  const res = await base44.functions.invoke('freeLaunch', {
    action: 'fund',
    wallet_address: walletAddress,
  });
  return res.data;
}