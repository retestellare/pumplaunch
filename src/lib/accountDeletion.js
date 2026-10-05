import { base44 } from '@/api/base44Client';

/**
 * Everything the app stores for a wallet address.
 *
 * Tokens are deliberately absent: they are real on-chain assets with their own
 * pools and holders, so erasing the app's record of one would break it for
 * everyone else holding it.
 */
const ACCOUNT_DATA = [
  {
    key: 'profile',
    label: 'Profile',
    of: (a) => base44.entities.Profile.filter({ wallet_address: a }),
    drop: (a) => base44.entities.Profile.deleteMany({ wallet_address: a }),
  },
  {
    key: 'posts',
    label: 'Posts',
    of: (a) => base44.entities.Post.filter({ author: a }),
    drop: (a) => base44.entities.Post.deleteMany({ author: a }),
  },
  {
    key: 'comments',
    label: 'Comments',
    of: (a) => base44.entities.Comment.filter({ author: a }),
    drop: (a) => base44.entities.Comment.deleteMany({ author: a }),
  },
  {
    key: 'trades',
    label: 'Trades',
    of: (a) => base44.entities.Trade.filter({ user_address: a }),
    drop: (a) => base44.entities.Trade.deleteMany({ user_address: a }),
  },
  {
    key: 'activity',
    label: 'Activity history',
    of: (a) => base44.entities.Activity.filter({ wallet_address: a }),
    drop: (a) => base44.entities.Activity.deleteMany({ wallet_address: a }),
  },
  {
    key: 'attempts',
    label: 'Unfinished launch attempts',
    of: (a) => base44.entities.LaunchAttempt.filter({ wallet_address: a }),
    drop: (a) => base44.entities.LaunchAttempt.deleteMany({ wallet_address: a }),
  },
];

/** Rows for the confirmation list. A null count is one that could not be read. */
export function accountDataRows(counts) {
  return ACCOUNT_DATA.map(({ key, label }) => ({
    key,
    label,
    count: counts?.[key] ?? null,
  }));
}

/** Counts what is stored for one address, so the user confirms against real numbers. */
export async function summarizeAccount(address) {
  if (!address) return {};
  const counts = {};
  await Promise.all(
    ACCOUNT_DATA.map(async ({ key, of: read }) => {
      try {
        const rows = await read(address);
        counts[key] = rows?.length || 0;
      } catch {
        counts[key] = null;
      }
    })
  );
  return counts;
}

/**
 * Erases an address's data, one entity at a time so a single failure cannot
 * abort the rest. Returns the labels that could not be removed.
 */
export async function purgeAccount(address, onStep) {
  const failed = [];
  for (const { label, drop } of ACCOUNT_DATA) {
    onStep?.(`Removing ${label.toLowerCase()}…`);
    try {
      await drop(address);
    } catch {
      failed.push(label.toLowerCase());
    }
  }
  return { failed };
}