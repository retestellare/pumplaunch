import { base44 } from '@/api/base44Client';

const SECRET_PREFIX = 'stellarlaunch_issuer_secret_';
const VAULT_SECRET_PREFIX = 'stellarlaunch_vault_secret_';
const idCache = new Map();
let saveChain = Promise.resolve();

function secretKey(walletAddress, symbol) {
  return `${SECRET_PREFIX}${(walletAddress || '').toLowerCase()}_${(symbol || '').toUpperCase()}`;
}

function vaultSecretKey(walletAddress, symbol) {
  return `${VAULT_SECRET_PREFIX}${(walletAddress || '').toLowerCase()}_${(symbol || '').toUpperCase()}`;
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
    launch_model: attempt.launch_model || 'curve',
    locked_quote: attempt.locked_quote || 'xlm',
    locked_deposit: parseFloat(attempt.locked_deposit) || 0,
    vault_tokens: parseFloat(attempt.vault_tokens) || 0,
    creator_allocation: parseFloat(attempt.creator_allocation) || 0,
    tokens_per_quote: parseFloat(attempt.tokens_per_quote) || 0,
    vault_public_key: attempt.vault_public_key || '',
    step: attempt.step || 'start',
    step_label: attempt.step_label || attempt.stepLabel || '',
    error: attempt.error || '',
    error_code: attempt.error_code || attempt.errorCode || '',
  };
  // Recorded once, before the USDC leg is bought, so a resume can tell how much
  // of the wallet's USDC came from the launch's own swap.
  if (typeof attempt.usdc_before_swap === 'number') record.usdc_before_swap = attempt.usdc_before_swap;

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
    localStorage.removeItem(vaultSecretKey(walletAddress, symbol));
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

// The key of the locked-liquidity vault. It signs the vault's deposit and then
// sets its own weight to zero, so losing it is the point — it is kept in this
// browser only until the lock transaction lands.
export function getVaultSecret(walletAddress, symbol) {
  try {
    return localStorage.getItem(vaultSecretKey(walletAddress, symbol)) || null;
  } catch {
    return null;
  }
}

export function setVaultSecret(walletAddress, symbol, secret) {
  try {
    localStorage.setItem(vaultSecretKey(walletAddress, symbol), secret);
  } catch {
    /* storage unavailable */
  }
}