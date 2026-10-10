import { base44 } from '@/api/base44Client';

const SECRET_PREFIX = 'stellarlaunch_issuer_secret_';
const idCache = new Map();
let saveChain = Promise.resolve();

function secretKey(walletAddress, symbol) {
  return `${SECRET_PREFIX}${(walletAddress || '').toLowerCase()}_${(symbol || '').toUpperCase()}`;
}

export async function loadAttempt(walletAddress) {
  if (!walletAddress) return null;
  try {
    const records = await base44.entities.LaunchAttempt.filter(
      { wallet_address: walletAddress },
      '-updated_date',
      5
    );
    if (!records || records.length === 0) return null;
    const rec = records[0];
    idCache.set(walletAddress, rec.id);
    return rec;
  } catch {
    return null;
  }
}

export function saveAttempt(attempt) {
  const p = saveChain.then(() => doSave(attempt));
  saveChain = p.catch(() => {});
  return p;
}

async function doSave(attempt) {
  if (!attempt?.wallet_address) return null;

  if (attempt.issuer_secret) {
    try {
      localStorage.setItem(secretKey(attempt.wallet_address, attempt.symbol), attempt.issuer_secret);
    } catch {
      /* storage unavailable */
    }
  }

  const record = {
    wallet_address: attempt.wallet_address,
    name: attempt.name || '',
    symbol: attempt.symbol || '',
    description: attempt.description || '',
    supply: typeof attempt.supply === 'number' ? attempt.supply : parseFloat(attempt.supply) || 0,
    custom_domain: attempt.custom_domain || attempt.customDomain || '',
    liquidity: attempt.liquidity ?? 100,
    auto_pool: attempt.auto_pool ?? attempt.autoPool ?? false,
    pool_type: attempt.pool_type || attempt.poolType || 'xlm',
    initial_liquidity: attempt.initial_liquidity ?? attempt.initialLiquidity ?? 0,
    curve: attempt.curve || 'slow',
    image_url: attempt.image_url || attempt.imageUrl || '',
    token_id: attempt.token_id || '',
    issuer_public_key: attempt.issuer_public_key || attempt.issuerPublicKey || '',
    reused_asset: attempt.reused_asset ?? attempt.reusedAsset ?? false,
    step: attempt.step || 'start',
    step_label: attempt.step_label || attempt.stepLabel || '',
    error: attempt.error || '',
    error_code: attempt.error_code || attempt.errorCode || '',
  };

  try {
    let id = idCache.get(attempt.wallet_address);
    if (!id) {
      const existing = await loadAttempt(attempt.wallet_address);
      id = existing?.id;
    }
    if (id) {
      return await base44.entities.LaunchAttempt.update(id, record);
    }
    const created = await base44.entities.LaunchAttempt.create(record);
    idCache.set(attempt.wallet_address, created.id);
    return created;
  } catch {
    return null;
  }
}

export async function clearAttempt(walletAddress, symbol) {
  idCache.delete(walletAddress);
  try {
    const records = await base44.entities.LaunchAttempt.filter({ wallet_address: walletAddress });
    for (const r of records || []) {
      try {
        await base44.entities.LaunchAttempt.delete(r.id);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(secretKey(walletAddress, symbol));
  } catch {
    /* ignore */
  }
}

export function getIssuerSecret(walletAddress, symbol) {
  try {
    return localStorage.getItem(secretKey(walletAddress, symbol)) || null;
  } catch {
    return null;
  }
}

// The issuer key of a launch in flight. It stays in this browser only — never in
// the database — so a retry can pick the same issuer back up instead of
// stranding a half-created asset.
export function setIssuerSecret(walletAddress, symbol, secret) {
  try {
    localStorage.setItem(secretKey(walletAddress, symbol), secret);
  } catch {
    /* storage unavailable */
  }
}