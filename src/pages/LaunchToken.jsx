import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { recordReward } from '@/lib/rewards';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import LaunchStepTracker, { STEPS } from '@/components/LaunchStepTracker';
import LaunchGuide from '@/components/LaunchGuide';
import OptionGroup from '@/components/launch/OptionGroup';
import PoolPairSelector, { fmtPoolAmount } from '@/components/launch/PoolPairSelector';
import ShareButton from '@/components/ShareButton';
import { launchShare } from '@/lib/share';
import { ensureOgCard } from '@/lib/ogImage';
import {
  loadAccount,
  parseBalances,
  buildLaunchSetupTransaction,
  buildIssuerSetupTransaction,
  buildBondingCurveTransaction,
  buildPoolSetupTransaction,
  buildXlmToUsdcSwapTransaction,
  verifyLaunchProgress,
  keypairFromSecret,
  BASE_PRICE,
  submitProgrammatically,
  signAndSubmit,
  submitWithRetry,
  generateStellarToml,
  estimateLaunchCost,
  CURVE_PRESETS,
  HOME_DOMAIN,
  pollForAccount,
  pollForTransaction,
  findExistingTrustline,
  fetchTokenMetadata,
  fetchOrderBook,
  fetchPoolPrice,
  fetchPoolFor,
  fetchXlmUsdcRate,
  planPoolLaunch,
  USDC_CODE,
  USDC_ISSUER,
} from '@/lib/stellar';
import { POOL_TYPES, poolsForType, quoteOf } from '@/lib/pools';
import {
  loadAttempt,
  saveAttempt,
  clearAttempt,
  getIssuerSecret,
  getVaultSecret,
  setVaultSecret,
} from '@/lib/launchAttempts';
import LaunchTypeSwitch from '@/components/LaunchTypeSwitch';
import LockedLiquidityForm from '@/components/launch/LockedLiquidityForm';
import {
  planLockedLaunch,
  vaultFunding,
  newVaultKeypair,
  buildVaultCreationTransaction,
  buildVaultTrustTransaction,
  buildVaultFundingTransfer,
  buildVaultDepositAndLockTransaction,
  readVaultState,
} from '@/lib/lockedLiquidity';
import { ImagePlus } from 'lucide-react';

const DISTRIBUTION_OPTIONS = [
  { value: 100, label: '100% Liquidity', desc: 'All tokens seeded to the DEX bonding curve' },
  { value: 'auto_pool', label: '100% Auto-Pool', desc: '100% of XLM from purchases goes directly into the Stellar Liquidity Pool to automatically support liquidity.' },
  { value: 'locked', label: 'Locked Liquidity', desc: 'Your deposit is locked in a pool nobody can withdraw. You receive half the supply, buyers release the rest.' },
];

// Only these two paces are offered at launch.
const CURVE_KEYS = ['slow', 'fast'];
const CURVE_OPTIONS = CURVE_KEYS.map((key) => {
  const p = CURVE_PRESETS[key];
  return { value: key, label: p.label, desc: p.desc, meta: `${p.rungs} rungs · ${p.priceStep}× step` };
});

const STEP_LABELS = STEPS.reduce((acc, s) => ({ ...acc, [s.id]: s.label }), { start: 'Start' });

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

function cleanDomain(d) {
  return d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase().trim();
}

function stepLabel(id) {
  return STEP_LABELS[id] || id || 'unknown step';
}

// A split launch buys its USDC leg with XLM: tolerate a 2% move between the
// quote and the swap landing.
const SWAP_SLIPPAGE = 0.02;

function usdcBalance(account) {
  const b = (account?.balances || []).find((x) => x.asset_code === USDC_CODE && x.asset_issuer === USDC_ISSUER);
  return b ? parseFloat(b.balance) : 0;
}

function analyzeStall(attempt, availableXlm, xlmPerUsdc = 0) {
  const locked = attempt.launch_model === 'locked';
  const curvePreset = CURVE_PRESETS[attempt.curve] || CURVE_PRESETS.slow;
  const plan = planPoolLaunch({
    poolType: attempt.pool_type || 'xlm',
    input: locked ? '' : attempt.initial_liquidity,
    xlmPerUsdc,
  });
  const cost = estimateLaunchCost({
    liquidityPercent: locked ? 0 : attempt.liquidity,
    rungs: curvePreset.rungs,
    autoPool: attempt.auto_pool || locked,
    hasInitialLiquidity: locked || !!(attempt.initial_liquidity && parseFloat(attempt.initial_liquidity) >= 10),
    poolCount: locked ? 1 : plan.quotes.length,
    needsUsdcTrustline: !locked && plan.quotes.includes('usdc'),
  });
  const lockedQuote = attempt.locked_quote === 'usdc' ? 'usdc' : 'xlm';
  const lockedDeposit = parseFloat(attempt.locked_deposit) || 0;
  const poolDeposit = locked
    ? lockedQuote === 'xlm'
      ? lockedDeposit
      : 0
    : (parseFloat(plan.deposits.xlm) || 0) + (plan.swapXlm || 0);
  const issuerReserve = attempt.issuer_public_key ? 0 : cost.issuerReserveXlm;
  const required =
    issuerReserve +
    poolDeposit +
    cost.feeXlm +
    cost.reserveXlm +
    (locked ? vaultFunding(0, lockedQuote) : 0);
  const insufficient = availableXlm != null && availableXlm < required;
  let reason = attempt.error;
  if (!reason) reason = insufficient ? 'Insufficient XLM to finish the launch.' : 'Launch was interrupted. Resume to continue from where it stopped.';
  return { required, insufficient, reason };
}

export default function LaunchToken() {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', symbol: '', description: '', supply: '1000000000', customDomain: '' });
  const [liquidity, setLiquidity] = useState(100);
  const [autoPool, setAutoPool] = useState(false);
  // The locked model: every deposit is matched by an equal half of the supply,
  // and the pool shares are locked away forever.
  const [lockedMode, setLockedMode] = useState(false);
  const [lockedQuote, setLockedQuote] = useState('xlm');
  const [lockedDeposit, setLockedDeposit] = useState('');
  const [initialLiquidity, setInitialLiquidity] = useState('');
  const [curve, setCurve] = useState('slow');
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tomlText, setTomlText] = useState('');
  const [tokenId, setTokenId] = useState(null);
  const [availableXlm, setAvailableXlm] = useState(null);
  const [availableUsdc, setAvailableUsdc] = useState(null);
  const [usdcTrustline, setUsdcTrustline] = useState(false);
  const [xlmPerUsdc, setXlmPerUsdc] = useState(0);
  // Which pool pair an Auto-Pool launch seeds. Bonding-curve launches stay XLM.
  const [poolType, setPoolType] = useState('xlm');
  const [attempt, setAttempt] = useState(null);
  const [stepStatuses, setStepStatuses] = useState({});
  const [waiting, setWaiting] = useState(false);
  const [stalledAttempt, setStalledAttempt] = useState(null);
  const [stallLoading, setStallLoading] = useState(true);
  const [attemptRefreshKey, setAttemptRefreshKey] = useState(0);

  useEffect(() => {
    if (!wallet?.address) {
      setAvailableXlm(null);
      setStalledAttempt(null);
      setStallLoading(false);
      return;
    }
    let active = true;
    setStallLoading(true);
    (async () => {
      const a = await loadAttempt(wallet.address);
      if (active) {
        setStalledAttempt(a && a.step !== 'done' ? a : null);
        setStallLoading(false);
      }
    })();
    (async () => {
      try {
        const account = await loadAccount(wallet.address);
        if (!active) return;
        setAvailableXlm(account ? parseBalances(account).availableXlm : 0);
        const usd = (account?.balances || []).find(
          (b) => b.asset_code === USDC_CODE && b.asset_issuer === USDC_ISSUER
        );
        setAvailableUsdc(usd ? parseFloat(usd.balance) : 0);
        setUsdcTrustline(!!usd);
      } catch {
        if (active) {
          setAvailableXlm(0);
          setAvailableUsdc(0);
        }
      }
    })();
    (async () => {
      const rate = await fetchXlmUsdcRate();
      if (active) setXlmPerUsdc(rate);
    })();
    return () => {
      active = false;
    };
  }, [wallet?.address, attemptRefreshKey]);

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: 'Image must be 2MB or smaller', variant: 'destructive' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const validate = () => {
    if (!wallet) {
      toast({ title: 'Connect your wallet first', variant: 'destructive' });
      return false;
    }
    if (stalledAttempt) {
      toast({ title: 'Resolve the unfinished launch first', description: 'Resume or discard the interrupted launch above before starting a new one.', variant: 'destructive' });
      return false;
    }
    if (!form.name.trim() || !form.symbol.trim()) {
      toast({ title: 'Name and symbol are required', variant: 'destructive' });
      return false;
    }
    const sym = form.symbol.toUpperCase();
    if (sym.length < 4 || sym.length > 12 || !/^[A-Z0-9]+$/.test(sym)) {
      toast({ title: 'Symbol must be 4-12 alphanumeric characters', variant: 'destructive' });
      return false;
    }
    if (!autoPool && !lockedMode) {
      const supply = parseFloat(form.supply);
      if (!supply || supply <= 0) {
        toast({ title: 'Enter a valid supply', variant: 'destructive' });
        return false;
      }
    }
    if (form.customDomain) {
      const cleaned = cleanDomain(form.customDomain);
      if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(cleaned)) {
        toast({ title: 'Invalid domain format (e.g. mytoken.com)', variant: 'destructive' });
        return false;
      }
    }
    if (lockedMode) {
      if (!(lockedPlan.deposit > 0)) {
        toast({ title: `Enter the ${lockedUnit} you want to lock`, variant: 'destructive' });
        return false;
      }
      if (lockedQuote === 'usdc' && !(xlmPerUsdc > 0)) {
        toast({ title: 'Still reading the XLM/USDC rate', description: 'Give it a moment and try again.', variant: 'destructive' });
        return false;
      }
      return true;
    }
    const il = parseFloat(initialLiquidity);
    if (autoPool) {
      if (needsUsdc && !(xlmPerUsdc > 0)) {
        toast({ title: 'Still reading the XLM/USDC rate', description: 'Give it a moment and try again.', variant: 'destructive' });
        return false;
      }
      if (!il || il < 10) {
        toast({ title: `Initial Liquidity must be at least 10 ${inputUnit} for Auto-Pool`, variant: 'destructive' });
        return false;
      }
    } else if (initialLiquidity && (!il || il < 10)) {
      toast({ title: 'Initial Liquidity must be at least 10 XLM', variant: 'destructive' });
      return false;
    }
    return true;
  };

  const review = () => {
    if (!validate()) return;
    setStep('confirm');
  };

  const setStepStatus = (id, status) => setStepStatuses((prev) => ({ ...prev, [id]: status }));

  const failStep = async (store, stepId, e) => {
    setStepStatus(stepId, 'failed');
    const updated = { ...store, step: stepId, error: e?.message || String(e), error_code: e?.stellarCode || '' };
    setAttempt(updated);
    await saveAttempt(updated);
    setAttemptRefreshKey((k) => k + 1);
  };

  const runLaunch = async (incoming) => {
    const store = { ...incoming, error: null, error_code: '' };
    setStep('progress');
    setAttempt({ ...store });
    setStepStatuses({});
    setWaiting(false);
    setRetrying(false);
    setLoading(true);

    const sym = (store.symbol || '').toUpperCase();
    const customDomain = store.custom_domain ? cleanDomain(store.custom_domain) : (store.customDomain ? cleanDomain(store.customDomain) : '');
    const homeDomain = customDomain || HOME_DOMAIN;
    const isLocked = store.launch_model === 'locked';
    store.symbol = sym;
    store.custom_domain = customDomain;
    store.pool_type = isLocked
      ? store.locked_quote === 'usdc'
        ? 'usdc'
        : 'xlm'
      : store.pool_type || 'xlm';

    const setStage = (stepId, label) => {
      store.step = stepId;
      store.step_label = label;
      setAttempt({ ...store });
      saveAttempt(store);
    };

    try {
      if (!wallet?.address) throw new Error('Wallet not connected.');

      if (!store.image_url && imageFile) {
        setStage('issuer', 'Uploading logo…');
        const uploadResult = await base44.integrations.Core.UploadPublicFile({ file: imageFile });
        store.image_url = uploadResult.file_url;
        saveAttempt(store);
      }

      const account = await loadAccount(wallet.address);
      if (!account) {
        throw new Error('Your wallet account was not found. Fund it with XLM on Stellar mainnet first.');
      }

      if (!store.issuer_public_key && !store.issuerPublicKey) {
        const existingIssuer = await findExistingTrustline(wallet.address, sym);
        if (existingIssuer) {
          store.issuer_public_key = existingIssuer;
          store.issuer_secret = null;
          store.reused_asset = true;
          saveAttempt(store);
          setAttempt({ ...store });
          toast({ title: `Existing $${sym} found`, description: 'Reusing the token you already hold — no new trustline created.' });
        }
      }

      const launchQuotes = poolsForType(store.pool_type);
      const poolRate = launchQuotes.includes('usdc') ? await fetchXlmUsdcRate() : 0;
      const launchPlan = planPoolLaunch({
        poolType: store.pool_type,
        input: store.initial_liquidity,
        xlmPerUsdc: poolRate,
      });
      if (store.auto_pool && launchQuotes.includes('usdc') && !(poolRate > 0)) {
        throw new Error('Could not read the XLM/USDC rate just now. Try again in a moment.');
      }

      // A locked launch derives its supply from the deposit: half goes to the
      // creator, the other half is matched against the deposit in the lock.
      const lockedPlanForLaunch = isLocked
        ? planLockedLaunch({
            quote: store.locked_quote,
            deposit: store.locked_deposit,
            xlmPerUsdc: await fetchXlmUsdcRate(),
          })
        : null;
      if (isLocked && !lockedPlanForLaunch.ready) {
        throw new Error('That deposit cannot open a locked launch. Check the XLM/USDC rate and try again.');
      }

      const supply = store.reused_asset
        ? parseFloat(store.supply) || 0
        : store.auto_pool
        ? launchPlan.supply
        : isLocked
        ? lockedPlanForLaunch.supply
        : parseFloat(store.supply);
      if (!store.reused_asset && (!supply || isNaN(supply) || supply <= 0)) {
        throw new Error('Invalid supply. Enter a valid total supply and try again.');
      }
      store.supply = supply;

      if (isLocked) {
        store.locked_deposit = lockedPlanForLaunch.deposit;
        store.vault_tokens = lockedPlanForLaunch.vaultTokens;
        store.creator_allocation = lockedPlanForLaunch.creatorTokens;
        store.tokens_per_quote = lockedPlanForLaunch.tokensPerQuote;
        saveAttempt(store);
      }

      // Step 1: Create issuer account + trustline
      setStage('issuer', store.reused_asset ? 'Existing token — skipped' : 'Creating issuer account…');
      if (store.reused_asset) {
        setStepStatus('issuer', 'done');
      } else {
        const issuerPk = store.issuer_public_key || store.issuerPublicKey;
        const p1 = issuerPk
          ? await verifyLaunchProgress({ walletAddress: wallet.address, issuerPublicKey: issuerPk, assetCode: sym, isAutoPool: store.auto_pool })
          : { trustlineExists: false, tokensIssued: false, liquidityExists: false };
        if (p1.trustlineExists) {
          setStepStatus('issuer', 'done');
        } else {
          setWaiting(true);
          setStage('issuer', 'Waiting for your wallet…');
          let issuerKp = null;
          const buildSetupTx = async () => {
            const acct = await loadAccount(wallet.address);
            const res = buildLaunchSetupTransaction({
              sourceAccount: acct,
              assetCode: sym,
              homeDomain,
              issuerKeypair: issuerKp,
            });
            issuerKp = res.issuerKeypair;
            store.issuer_public_key = issuerKp.publicKey();
            store.issuer_secret = issuerKp.secret();
            return res.transaction;
          };
          try {
            await submitWithRetry(buildSetupTx, signAndSubmit, {
              onRetry: (i, max) => {
                setRetrying(true);
                setStage('issuer', `Retrying (${i}/${max})…`);
              },
              verify: async () => {
                if (!store.issuer_public_key) return false;
                const p = await verifyLaunchProgress({ walletAddress: wallet.address, issuerPublicKey: store.issuer_public_key, assetCode: sym, isAutoPool: store.auto_pool });
                return p.trustlineExists;
              },
            });
            saveAttempt(store);
            setAttempt({ ...store });
            await pollForAccount(store.issuer_public_key);
          } catch (e) {
            await failStep(store, 'issuer', e);
            throw e;
          } finally {
            setWaiting(false);
            setRetrying(false);
          }
          setStage('issuer', 'Issuer account created');
          setStepStatus('issuer', 'done');
        }
      }

      // Step 2: Issue tokens
      setStage('issue', store.reused_asset ? 'Existing token — skipped' : 'Issuing tokens…');
      if (store.reused_asset) {
        setStepStatus('issue', 'done');
      } else {
        const p2 = await verifyLaunchProgress({ walletAddress: wallet.address, issuerPublicKey: store.issuer_public_key, assetCode: sym, isAutoPool: store.auto_pool });
        if (p2.tokensIssued) {
          setStepStatus('issue', 'done');
        } else {
          const issuerSecret = store.issuer_secret || getIssuerSecret(wallet.address, sym);
          if (!issuerSecret) {
            const err = new Error("The issuer was created on another device and its key isn't available here. Return to that device to finish, or discard (the 2 XLM reserve is lost).");
            await failStep(store, 'issue', err);
            throw err;
          }
          const issuerKeypair = keypairFromSecret(issuerSecret);
          const buildIssueTx = async () => {
            const issuerAccount = await loadAccount(store.issuer_public_key);
            if (!issuerAccount) throw new Error('Issuer account not found after creation');
            return buildIssuerSetupTransaction({
              issuerAccount,
              userAddress: wallet.address,
              assetCode: sym,
              totalSupply: supply,
              homeDomain,
            });
          };
          setWaiting(true);
          try {
            const result = await submitWithRetry(buildIssueTx, (tx) => submitProgrammatically(tx, issuerKeypair), {
              onRetry: (i, max) => {
                setRetrying(true);
                setStage('issue', `Retrying (${i}/${max})…`);
              },
              verify: async () => {
                const p = await verifyLaunchProgress({ walletAddress: wallet.address, issuerPublicKey: store.issuer_public_key, assetCode: sym, isAutoPool: store.auto_pool });
                return p.tokensIssued;
              },
            });
            if (result) await pollForTransaction(result);
          } catch (e) {
            await failStep(store, 'issue', e);
            throw e;
          } finally {
            setWaiting(false);
            setRetrying(false);
          }
          saveAttempt(store);
          setAttempt({ ...store });
          setStage('issue', 'Tokens issued');
          setStepStatus('issue', 'done');
        }
      }

      // A split launch takes XLM only: the USDC leg is bought on the DEX here.
      // What the swap delivered is measured against the wallet's pre-swap
      // balance, so USDC the creator already holds stays theirs.
      const convertUsdcLeg = async () => {
        const expected = launchPlan.deposits.usdc;
        const floor = expected * (1 - SWAP_SLIPPAGE);
        const account = await loadAccount(wallet.address);
        if (store.usdc_before_swap == null) {
          store.usdc_before_swap = usdcBalance(account);
          saveAttempt(store);
        }
        let received = usdcBalance(account) - store.usdc_before_swap;
        if (received < floor) {
          setStage('liquidity', 'Converting XLM to USDC…');
          await submitWithRetry(
            async () => {
              const acct = await loadAccount(wallet.address);
              return buildXlmToUsdcSwapTransaction({
                sourceAccount: acct,
                xlmAmount: launchPlan.swapXlm,
                minUsdcOut: floor,
              });
            },
            signAndSubmit,
            {
              onRetry: (i, max) => {
                setRetrying(true);
                setStage('liquidity', `Retrying XLM → USDC conversion (${i}/${max})…`);
              },
              verify: async () => usdcBalance(await loadAccount(wallet.address)) - store.usdc_before_swap >= floor,
            }
          );
          // Horizon can lag by a ledger; wait for the bought USDC to show up so
          // the pool is seeded with the amount that actually landed.
          for (let i = 0; i < 6 && received < floor; i++) {
            if (i > 0) await new Promise((r) => setTimeout(r, 2000));
            received = usdcBalance(await loadAccount(wallet.address)) - store.usdc_before_swap;
          }
          saveAttempt(store);
        }
        return received >= floor && received <= expected * 1.1 ? received : expected;
      };

      // Step 3: Seed liquidity
      setStage('liquidity', store.reused_asset ? 'Existing token — skipped' : 'Seeding liquidity…');
      if (store.reused_asset) {
        setStepStatus('liquidity', 'done');
      } else if (isLocked) {
        const quote = store.locked_quote === 'usdc' ? 'usdc' : 'xlm';
        const deposit = parseFloat(store.locked_deposit) || 0;
        const tokenHalf = parseFloat(store.vault_tokens) || 0;

        // The vault is its own account: it receives the deposit and the matched
        // half of the supply, deposits them into the pool, and loses its only
        // signer in the same transaction. Nobody can withdraw the liquidity after.
        if (!store.vault_public_key) {
          const vaultKp = newVaultKeypair();
          store.vault_public_key = vaultKp.publicKey();
          setVaultSecret(wallet.address, sym, vaultKp.secret());
          saveAttempt(store);
          setAttempt({ ...store });
        }
        const vaultSecret = getVaultSecret(wallet.address, sym);
        if (!vaultSecret) {
          const err = new Error(
            "This launch's vault was created on another device. Finish the lock on that device."
          );
          await failStep(store, 'liquidity', err);
          throw err;
        }
        const vault = keypairFromSecret(vaultSecret);
        const vaultAddress = vault.publicKey();
        const vaultArgs = { vaultAddress, assetCode: sym, issuer: store.issuer_public_key, quote };

        setWaiting(true);
        try {
          let state = await readVaultState(vaultArgs);

          if (!state.exists) {
            setStage('liquidity', 'Opening the locked vault…');
            await submitWithRetry(
              async () => {
                const userAccount = await loadAccount(wallet.address);
                return buildVaultCreationTransaction({
                  sourceAccount: userAccount,
                  vaultAddress,
                  startingBalance: vaultFunding(deposit, quote),
                });
              },
              signAndSubmit,
              {
                onRetry: (i, max) => {
                  setRetrying(true);
                  setStage('liquidity', `Retrying the vault (${i}/${max})…`);
                },
              }
            );
            await pollForAccount(vaultAddress);
            state = await readVaultState(vaultArgs);
          }

          if (!state.hasTokenTrustline || !state.hasPoolTrustline || !state.hasQuoteTrustline) {
            setStage('liquidity', 'Preparing the vault…');
            await submitProgrammatically(
              buildVaultTrustTransaction({
                vaultAccount: await loadAccount(vaultAddress),
                assetCode: sym,
                issuer: store.issuer_public_key,
                quote,
              }),
              vault
            );
            state = await readVaultState(vaultArgs);
          }

          if (state.tokenBalance < tokenHalf - 0.0000001 || state.quoteBalance < deposit - 0.0000001) {
            setStage('liquidity', 'Moving the deposit into the vault…');
            await submitWithRetry(
              async () => {
                const userAccount = await loadAccount(wallet.address);
                return buildVaultFundingTransfer({
                  sourceAccount: userAccount,
                  vaultAddress,
                  assetCode: sym,
                  issuer: store.issuer_public_key,
                  quote,
                  tokenAmount: tokenHalf,
                  deposit,
                });
              },
              signAndSubmit,
              {
                onRetry: (i, max) => {
                  setRetrying(true);
                  setStage('liquidity', `Retrying the transfer (${i}/${max})…`);
                },
              }
            );
          }

          state = await readVaultState(vaultArgs);
          if (!state.locked) {
            setStage('liquidity', 'Locking the liquidity forever…');
            await submitWithRetry(
              async () => {
                const vaultAccount = await loadAccount(vaultAddress);
                return buildVaultDepositAndLockTransaction({
                  vaultAccount,
                  assetCode: sym,
                  issuer: store.issuer_public_key,
                  quote,
                  deposit,
                  tokenAmount: tokenHalf,
                });
              },
              (tx) => submitProgrammatically(tx, vault),
              {
                onRetry: (i, max) => {
                  setRetrying(true);
                  setStage('liquidity', `Retrying the lock (${i}/${max})…`);
                },
              }
            );
          }
          saveAttempt(store);
          setAttempt({ ...store });
        } catch (e) {
          await failStep(store, 'liquidity', e);
          throw e;
        } finally {
          setWaiting(false);
          setRetrying(false);
        }
        setStage('liquidity', 'Liquidity locked');
        setStepStatus('liquidity', 'done');
      } else {
        const p3 = await verifyLaunchProgress({ walletAddress: wallet.address, issuerPublicKey: store.issuer_public_key, assetCode: sym, isAutoPool: store.auto_pool, quotes: launchQuotes });
        if (!p3.liquidityExists) {
          setWaiting(true);
          try {
            if (store.auto_pool) {
              const poolAmounts = { ...launchPlan.deposits };
              if (launchPlan.swapXlm > 0) poolAmounts.usdc = await convertUsdcLeg();
              // Dual launches seed one pool per quote, skipping any already live,
              // so a resume picks up exactly where it stopped.
              for (const q of launchPlan.quotes) {
                if (p3.poolQuotes?.includes(q)) continue;
                const label = q.toUpperCase();
                setStage('liquidity', launchPlan.quotes.length > 1 ? `Seeding ${label} pool…` : 'Seeding liquidity pool…');
                const buildPoolTx = async () => {
                  const userAccount = await loadAccount(wallet.address);
                  return buildPoolSetupTransaction({
                    sourceAccount: userAccount,
                    assetCode: sym,
                    issuer: store.issuer_public_key,
                    quote: q,
                    quoteAmount: poolAmounts[q],
                    tokenAmount: launchPlan.tokensByQuote[q],
                  });
                };
                await submitWithRetry(buildPoolTx, signAndSubmit, {
                  onRetry: (i, max) => { setRetrying(true); setStage('liquidity', `Retrying ${label} pool (${i}/${max})…`); },
                  verify: async () => !!(await fetchPoolFor(sym, store.issuer_public_key, q)),
                });
                saveAttempt(store);
              }
            } else {
              const liquidityAmount = (supply * store.liquidity) / 100;
              if (liquidityAmount > 0) {
                const curvePreset = CURVE_PRESETS[store.curve] || CURVE_PRESETS.slow;
                const buildBondingTx = async () => {
                  const userAccount = await loadAccount(wallet.address);
                  return buildBondingCurveTransaction({
                    userAccount,
                    assetCode: sym,
                    issuerPublicKey: store.issuer_public_key,
                    liquidityAmount,
                    rungs: curvePreset.rungs,
                    priceStep: curvePreset.priceStep,
                  });
                };
                await submitWithRetry(buildBondingTx, signAndSubmit, {
                  onRetry: (i, max) => { setRetrying(true); setStage('liquidity', `Retrying (${i}/${max})…`); },
                  verify: async () => {
                    const ob = await fetchOrderBook(sym, store.issuer_public_key);
                    return !!(ob && (ob.askCount > 0 || ob.bidCount > 0));
                  },
                });
              }
              if (store.initial_liquidity) {
                const xlmAmount = parseFloat(store.initial_liquidity);
                const tokenAmount = xlmAmount / BASE_PRICE;
                const buildPoolTx = async () => {
                  const userAccount = await loadAccount(wallet.address);
                  return buildPoolSetupTransaction({ sourceAccount: userAccount, assetCode: sym, issuer: store.issuer_public_key, xlmAmount, tokenAmount });
                };
                await submitWithRetry(buildPoolTx, signAndSubmit, {
                  onRetry: (i, max) => { setRetrying(true); setStage('liquidity', `Retrying (${i}/${max})…`); },
                  verify: async () => !!(await fetchPoolPrice(sym, store.issuer_public_key)),
                });
              }
            }
          } catch (e) {
            await failStep(store, 'liquidity', e);
            throw e;
          } finally {
            setWaiting(false);
            setRetrying(false);
          }
        }
        setStage('liquidity', 'Liquidity seeded');
        setStepStatus('liquidity', 'done');
      }

      // Step 4: List in app
      setStage('list', 'Listing in app…');
      if (store.reused_asset && (!store.image_url || store.name === store.symbol)) {
        try {
          const meta = await fetchTokenMetadata(sym, store.issuer_public_key);
          if (meta) {
            if (meta.logo && !store.image_url) store.image_url = meta.logo;
            if (meta.name) store.name = meta.name;
            saveAttempt(store);
            setAttempt({ ...store });
          }
        } catch {
          /* metadata optional */
        }
      }
      if (!store.token_id) {
        const existing = await base44.entities.Token.filter({ issuer: store.issuer_public_key, asset_code: sym });
        if (existing && existing.length > 0) {
          store.token_id = existing[0].id;
        } else {
          const toml = generateStellarToml({
            name: store.name,
            code: sym,
            issuer: store.issuer_public_key,
            description: store.description,
            logoUrl: store.image_url,
            orgUrl: customDomain ? `https://${customDomain}` : `https://${HOME_DOMAIN}`,
          });
          const record = {
            name: store.name,
            symbol: sym,
            description: store.description,
            image_url: store.image_url,
            creator: wallet.address,
            issuer: store.issuer_public_key,
            asset_code: sym,
            home_domain: homeDomain,
            custom_domain: customDomain || null,
            supply,
            liquidity_percent: store.liquidity,
            curve: store.curve,
            toml_content: toml,
            price: 0.000001,
            market_cap: 0.000001 * supply,
            holders: 1,
            volume_24h: 0,
            change_24h: 0,
            is_graduated: true,
            is_auto_pool: !!store.auto_pool,
            launch_model: store.launch_model || 'curve',
            locked_quote: isLocked ? store.locked_quote || 'xlm' : null,
            locked_liquidity: isLocked ? store.locked_deposit : 0,
            creator_allocation: isLocked ? store.creator_allocation : 0,
            vault_tokens: isLocked ? store.vault_tokens : 0,
            tokens_per_quote: isLocked ? store.tokens_per_quote : 0,
            lock_account: isLocked ? store.vault_public_key || '' : '',
            pools: poolsForType(store.pool_type),
          };
          let created;
          try {
            created = await base44.entities.Token.create(record);
          } catch {
            await new Promise((r) => setTimeout(r, 1500));
            created = await base44.entities.Token.create(record);
          }
          store.token_id = created.id;
          store.toml_text = toml;
          saveAttempt(store);
          setAttempt({ ...store });
        }
      }
      setStage('list', 'Listed');
      setStepStatus('list', 'done');

      // Give the new token its own share preview right away.
      try {
        await ensureOgCard({
          id: store.token_id,
          symbol: sym,
          name: store.name,
          description: store.description,
          image_url: store.image_url,
          issuer: store.issuer_public_key,
          supply,
        });
      } catch {
        /* the token page regenerates it if this fails */
      }

      try {
        await base44.entities.Activity.create({
          wallet_address: wallet.address,
          type: 'launch',
          token_symbol: sym,
          token_id: store.token_id,
          details: store.reused_asset ? `Listed $${sym}` : `Launched $${sym}`,
        });
      } catch {
        /* ignore */
      }

      await clearAttempt(wallet.address, sym);
      setAttemptRefreshKey((k) => k + 1);
      setTokenId(store.token_id);

      base44.analytics.track({
        eventName: 'token_launched',
        properties: { pool: store.pool_type, curve: store.curve, reused_asset: !!store.reused_asset },
      });

      // The launch itself earns a reward, credited once per token.
      if (wallet?.address && store.token_id) {
        recordReward({
          wallet: wallet.address,
          type: 'token_launch',
          ref: store.token_id,
          label: `$${sym} launch`,
        }).catch(() => {});
      }

      if (customDomain) {
        setTomlText(store.toml_text);
        setStep('toml');
        toast({ title: store.reused_asset ? `$${sym} listed!` : `$${sym} launched!`, description: 'Upload your toml next.' });
      } else {
        toast({ title: store.reused_asset ? `$${sym} listed in the app!` : `$${sym} launched on mainnet!` });
        navigate(`/token/${store.token_id}`);
      }
    } catch (e) {
      const reason = e?.message || String(e);
      toast({
        title: 'Launch step failed',
        description: `${reason}${e?.stellarCode ? ` (${e.stellarCode})` : ''}. Your progress is saved — resume safely when ready.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setWaiting(false);
      setRetrying(false);
    }
  };

  const handleNewLaunch = () => {
    const sym = form.symbol.toUpperCase();
    const store = {
      wallet_address: wallet.address,
      name: form.name.trim(),
      symbol: sym,
      description: form.description.trim(),
      supply: lockedMode ? lockedPlan.supply : form.supply,
      launch_model: lockedMode ? 'locked' : autoPool ? 'auto_pool' : 'curve',
      locked_quote: lockedQuote,
      locked_deposit: lockedMode ? lockedPlan.deposit : 0,
      vault_tokens: lockedMode ? lockedPlan.vaultTokens : 0,
      creator_allocation: lockedMode ? lockedPlan.creatorTokens : 0,
      tokens_per_quote: lockedMode ? lockedPlan.tokensPerQuote : 0,
      vault_public_key: null,
      custom_domain: form.customDomain,
      liquidity,
      auto_pool: autoPool,
      initial_liquidity: initialLiquidity,
      curve,
      pool_type: effectivePoolType,
      image_url: null,
      token_id: null,
      issuer_public_key: null,
      issuer_secret: null,
      reused_asset: false,
      step: 'start',
      step_label: '',
      error: null,
      error_code: '',
    };
    runLaunch(store);
  };

  const handleResume = () => {
    if (!stalledAttempt) return;
    const secret = getIssuerSecret(wallet.address, stalledAttempt.symbol);
    runLaunch({ ...stalledAttempt, issuer_secret: secret || null });
  };

  const handleRetry = () => {
    if (!attempt) return;
    const secret = attempt.issuer_secret || getIssuerSecret(wallet.address, attempt.symbol);
    runLaunch({ ...attempt, issuer_secret: secret || null });
  };

  const handleAbort = () => {
    setLoading(false);
    setWaiting(false);
    setRetrying(false);
    setStep('form');
  };

  const handleDiscard = async () => {
    if (!stalledAttempt) return;
    await clearAttempt(wallet.address, stalledAttempt.symbol);
    setStalledAttempt(null);
    setAttemptRefreshKey((k) => k + 1);
    toast({ title: 'Incomplete launch discarded', description: 'The 2 XLM issuer reserve cannot be recovered.' });
  };

  const curvePreset = CURVE_PRESETS[curve];
  // A locked launch quotes against the asset the creator picked; a bonding-curve
  // launch always seeds one XLM pool.
  const effectivePoolType = autoPool ? poolType : lockedMode ? lockedQuote : 'xlm';
  const plan = planPoolLaunch({ poolType: effectivePoolType, input: lockedMode ? '' : initialLiquidity, xlmPerUsdc });
  const lockedPlan = planLockedLaunch({ quote: lockedQuote, deposit: lockedDeposit, xlmPerUsdc });
  const lockedUnit = lockedQuote === 'usdc' ? 'USDC' : 'XLM';
  const poolCount = plan.quotes.length;
  const needsUsdc = effectivePoolType === 'usdc';
  const inputUnit = effectivePoolType === 'usdc' ? 'USDC' : 'XLM';
  const rateReady = !needsUsdc || xlmPerUsdc > 0;
  const allocation = plan.quotes.map((q) => ({
    quote: q,
    amount: plan.deposits[q] || 0,
    tokens: plan.tokensByQuote[q] || 0,
  }));
  const derivedSupply = plan.supply;
  const baseCost = estimateLaunchCost({
    liquidityPercent: lockedMode ? 0 : liquidity,
    rungs: curvePreset.rungs,
    autoPool: autoPool || lockedMode,
    hasInitialLiquidity: lockedMode ? true : !!(initialLiquidity && parseFloat(initialLiquidity) >= 10),
    poolCount: lockedMode ? 1 : poolCount,
    needsUsdcTrustline: needsUsdc && !usdcTrustline,
  });
  // The lock runs three more transactions from the vault's own account.
  const cost = lockedMode
    ? { ...baseCost, feeXlm: baseCost.feeXlm + 300 / 1e7, operations: baseCost.operations + 3 }
    : baseCost;
  // The vault keeps its own reserves forever, so this part never comes back.
  const vaultXlm = lockedMode ? vaultFunding(0, lockedQuote) : 0;
  const effectiveDomain = form.customDomain ? cleanDomain(form.customDomain) : HOME_DOMAIN;
  const swapXlm = lockedMode ? 0 : plan.swapXlm || 0;
  const depositXlm = lockedMode
    ? lockedQuote === 'xlm'
      ? lockedPlan.deposit
      : 0
    : parseFloat(plan.deposits.xlm) || 0;
  const requiredXlm = cost.issuerReserveXlm + depositXlm + swapXlm + cost.feeXlm + cost.reserveXlm + vaultXlm;
  // A split launch buys its USDC with XLM, so the wallet never needs USDC.
  const requiredUsdc = swapXlm > 0
    ? 0
    : lockedMode
    ? lockedQuote === 'usdc'
      ? lockedPlan.deposit
      : 0
    : parseFloat(plan.deposits.usdc) || 0;
  const xlmOk = availableXlm === null || availableXlm >= requiredXlm;
  const usdcOk = !needsUsdc || availableUsdc === null || availableUsdc >= requiredUsdc;
  const balanceOk = xlmOk && usdcOk;
  const blocked = !!stalledAttempt && !stallLoading;
  const stallAnalysis = stalledAttempt ? analyzeStall(stalledAttempt, availableXlm, xlmPerUsdc) : null;
  const progressAnalysis = attempt ? analyzeStall(attempt, availableXlm, xlmPerUsdc) : null;
  const showResume = attempt && (stepStatuses[attempt.step] === 'failed' || !!attempt.error);

  return (
    <PageLayout title="Launch Token" rightAction={<WalletButton />}>
      {step === 'form' ? (
        <div className="p-4 space-y-4">
          <LaunchTypeSwitch value="/launch" />
          <LaunchGuide />
          {stallLoading ? (
            <div className="text-center text-white/40 text-sm py-4">Checking for unfinished launches…</div>
          ) : stalledAttempt && stallAnalysis ? (
            <div className="bg-[#ff3b5c]/5 border border-[#ff3b5c]/30 rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-[#ff3b5c]">Incomplete ${stalledAttempt.symbol} launch — stopped</p>
                <p className="text-xs text-white/70 mt-1">{stallAnalysis.reason}</p>
                {stalledAttempt.error_code && (
                  <p className="text-[10px] text-white/30 mt-0.5">Code: {stalledAttempt.error_code}</p>
                )}
                {availableXlm != null && (
                  <p className="text-xs text-white/40 mt-1">
                    Required to finish: ~{stallAnalysis.required.toFixed(2)} XLM · Available: {availableXlm.toFixed(2)} XLM
                  </p>
                )}
                <p className="text-xs text-white/40 mt-1">
                  Stopped at: {stepLabel(stalledAttempt.step)}. Resume reuses the same issuer — no new trustline or 2 XLM reserve.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleResume} className="flex-1 py-2.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm">
                  Resume
                </button>
                <button onClick={handleDiscard} className="flex-1 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm">
                  Discard
                </button>
              </div>
            </div>
          ) : null}

          {blocked && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-xs text-white/50">You have an unfinished launch above. Resume or discard it before starting a new one.</p>
            </div>
          )}

          <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold">Token Details</h3>
              <p className="text-[10px] text-white/30 mt-0.5">Name, supply, logo and metadata</p>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Doge Rocket"
                disabled={blocked}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 disabled:opacity-40"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Symbol (4-12 chars)</label>
              <input
                value={form.symbol}
                onChange={(e) =>
                  setForm({ ...form, symbol: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) })
                }
                placeholder="e.g. DOGERKT"
                disabled={blocked}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 font-mono disabled:opacity-40"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe your memecoin…"
                rows={3}
                disabled={blocked}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 resize-none disabled:opacity-40"
              />
            </div>
            {autoPool || lockedMode ? (
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Total Supply (auto)</label>
                <div className="w-full bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl px-3 py-3 font-mono text-sm text-[#00ff88]">
                  {(() => {
                    const auto = autoPool ? derivedSupply : lockedPlan.supply;
                    return auto > 0 ? Math.floor(auto).toLocaleString() : '—';
                  })()}
                </div>
                <p className="text-[10px] text-white/30 mt-1">
                  {lockedMode
                    ? 'Half goes to you, half stays locked with your deposit.'
                    : 'Determined by your initial liquidity. More XLM = more tokens, all go to the pool.'}
                </p>
              </div>
            ) : (
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Total Supply</label>
                <input
                  type="number"
                  value={form.supply}
                  onChange={(e) => setForm({ ...form, supply: e.target.value })}
                  disabled={blocked}
                  className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 disabled:opacity-40"
                />
              </div>
            )}

            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Token Logo (optional, max 2MB)</label>
              <div className="flex items-center gap-3">
                {imagePreview ? (
                  <img src={imagePreview} alt="logo preview" className="w-14 h-14 rounded-xl object-cover" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-black/30 border border-white/5 flex items-center justify-center">
                    <ImagePlus size={20} className="text-white/30" />
                  </div>
                )}
                <label className="flex-1 cursor-pointer">
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" disabled={blocked} />
                  <div className="px-3 py-3 bg-black/30 border border-white/5 rounded-xl text-sm text-white/60 text-center hover:bg-white/5 transition disabled:opacity-40">
                    {imageFile ? 'Change image' : 'Upload logo'}
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Custom Domain (optional)</label>
              <input
                value={form.customDomain}
                onChange={(e) => setForm({ ...form, customDomain: e.target.value })}
                placeholder="e.g. mytoken.com"
                disabled={blocked}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 disabled:opacity-40"
              />
              <p className="text-[10px] text-white/30 mt-1">
                Leave empty to host the stellar.toml here. If provided, home_domain is set to your domain and you'll get the toml to upload.
              </p>
            </div>
          </div>

          {!lockedMode && (
          <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold">Market & Pool</h3>
              <p className="text-[10px] text-white/30 mt-0.5">
                Which Stellar market your token launches into, and how much liquidity you seed
              </p>
            </div>

            <div>
              <label className="text-xs text-white/40 mb-1.5 block">
                Initial Liquidity ({inputUnit})
                {autoPool && <span className="text-[#00ff88]"> · required</span>}
              </label>
              <input
                type="number"
                value={initialLiquidity}
                onChange={(e) => setInitialLiquidity(e.target.value)}
                placeholder={autoPool ? `Min 10 ${inputUnit}` : 'Optional (min 10 XLM)'}
                disabled={blocked}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 disabled:opacity-40"
              />
              <p className="text-[10px] text-white/30 mt-1">
                Minimum 10 {inputUnit}. Recommended 50+ for lower initial price slippage.
              </p>
              {autoPool && effectivePoolType === 'split' && (
                <p className="text-[10px] text-white/30 mt-1">
                  Half seeds the XLM pool; the other half is swapped to USDC at the live rate and seeds the USDC pool.
                </p>
              )}
            </div>
          </div>
          )}

          <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
            <div>
              <h3 className="text-sm font-bold">
                {lockedMode ? 'Locked Liquidity' : 'Supply Distribution & Bonding Curve'}
              </h3>
              <p className="text-[10px] text-white/30 mt-0.5">
                {lockedMode
                  ? 'Your deposit is locked forever; buyers release the rest of the supply'
                  : 'How much of the supply is seeded, and how steeply the curve prices it'}
              </p>
            </div>

            <OptionGroup
              label="Distribution"
              options={DISTRIBUTION_OPTIONS}
              isSelected={(opt) =>
                opt.value === 'locked' ? lockedMode : opt.value === 'auto_pool' ? autoPool : !autoPool && !lockedMode && liquidity === opt.value
              }
              onSelect={(opt) => {
                if (opt.value === 'locked') {
                  setLockedMode(true);
                  setAutoPool(false);
                } else if (opt.value === 'auto_pool') {
                  setLockedMode(false);
                  setAutoPool(true);
                } else {
                  setLockedMode(false);
                  setAutoPool(false);
                  setLiquidity(opt.value);
                }
              }}
              disabled={blocked}
            />

            {lockedMode && (
              <LockedLiquidityForm
                quote={lockedQuote}
                onQuote={setLockedQuote}
                deposit={lockedDeposit}
                onDeposit={setLockedDeposit}
                plan={lockedPlan}
                symbol={form.symbol.toUpperCase()}
                rateReady={rateReady}
                usdcTrustline={usdcTrustline}
                disabled={blocked}
              />
            )}

            {autoPool && (
              <PoolPairSelector
                poolType={poolType}
                onSelect={setPoolType}
                allocation={allocation}
                swap={{ xlm: swapXlm, usdc: parseFloat(plan.deposits.usdc) || 0 }}
                symbol={form.symbol || 'tokens'}
                needsUsdc={needsUsdc}
                rateReady={rateReady}
                usdcTrustline={usdcTrustline}
                disabled={blocked}
              />
            )}

            {!autoPool && !lockedMode && (
              <OptionGroup
                label="Price Curve"
                options={CURVE_OPTIONS}
                isSelected={(opt) => curve === opt.value}
                onSelect={(opt) => setCurve(opt.value)}
                disabled={blocked}
                note={
                  curve === 'fast' ? (
                    <div className="mt-2 bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-xl px-3 py-2">
                      <p className="text-xs text-white/60">
                        ⚠ Prices rise sharply after early buys — later buyers pay much more.
                      </p>
                    </div>
                  ) : null
                }
              />
            )}
          </div>

          {wallet && availableXlm !== null && !balanceOk && !blocked && (
            <div className="bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-xl p-3 space-y-1.5">
              <p className="text-xs text-[#ff3b5c] font-bold">Insufficient balance</p>
              {!xlmOk && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">XLM available</span>
                    <span className="text-white/80">{availableXlm.toFixed(2)} XLM</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">XLM required</span>
                    <span className="text-white/80">~{requiredXlm.toFixed(2)} XLM</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">
                    Fund your wallet with at least {(requiredXlm - availableXlm).toFixed(2)} more XLM on Stellar mainnet.
                  </p>
                </>
              )}
              {!usdcOk && availableUsdc != null && (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">USDC available</span>
                    <span className="text-white/80">{availableUsdc.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/40">USDC required</span>
                    <span className="text-white/80">~{requiredUsdc.toFixed(2)} USDC</span>
                  </div>
                  <p className="text-[10px] text-white/30 mt-1">
                    Add {usdcTrustline ? '' : 'a USDC trustline and '}at least{' '}
                    {(requiredUsdc - availableUsdc).toFixed(2)} more USDC to your wallet.
                  </p>
                </>
              )}
            </div>
          )}

          <button
            onClick={review}
            disabled={!wallet || blocked || !rateReady || (lockedMode && !lockedPlan.ready) || (wallet && availableXlm !== null && !balanceOk)}
            className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
          >
            {blocked
              ? 'Resolve launch above'
              : !wallet
              ? 'Connect Wallet First'
              : !rateReady
              ? 'Reading XLM/USDC rate…'
              : wallet && availableXlm !== null && !balanceOk
              ? 'Insufficient balance'
              : 'Review Launch'}
          </button>
        </div>
      ) : step === 'confirm' ? (
        <div className="p-4 space-y-4">
          <LaunchStepTracker steps={STEPS} currentStep="issuer" statuses={{}} />
          <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
            <h3 className="font-bold">Confirm Mainnet Launch</h3>
            <div className="space-y-2 text-sm">
              <Row label="Asset" value={form.symbol.toUpperCase()} />
              <Row label="Issuer" value="Auto-generated · Locked" />
              <Row label="Home Domain" value={effectiveDomain} />
              <Row
                label="Total Supply"
                value={(
                  autoPool ? Math.floor(derivedSupply) : lockedMode ? Math.floor(lockedPlan.supply) : parseFloat(form.supply)
                ).toLocaleString()}
              />
              <Row
                label="Launch Type"
                value={lockedMode ? 'Locked Liquidity' : POOL_TYPES.find((p) => p.value === effectivePoolType)?.label || 'Single Pool (XLM)'}
              />
              {autoPool ? (
                <>
                  <Row label="Mode" value="100% Auto-Pool" />
                  <Row label="Initial Liquidity" value={`${fmtPoolAmount(initialLiquidity)} ${inputUnit}`} />
                  {swapXlm > 0 && (
                    <Row
                      label="XLM → USDC Conversion"
                      value={`${fmtPoolAmount(swapXlm)} XLM → ~${fmtPoolAmount(plan.deposits.usdc)} USDC`}
                    />
                  )}
                  {allocation.map((a) => (
                    <Row
                      key={a.quote}
                      label={`${poolCount > 1 ? `${quoteOf(a.quote).label} Pool` : 'Pool'}`}
                      value={
                        a.amount > 0
                          ? `${fmtPoolAmount(a.amount)} ${quoteOf(a.quote).label} + ${Math.floor(a.tokens).toLocaleString()} ${
                              form.symbol.toUpperCase()
                            }`
                          : '—'
                      }
                    />
                  ))}
                  {needsUsdc && !usdcTrustline && <Row label="USDC Trustline" value="Added in this launch" />}
                </>
              ) : lockedMode ? (
                <>
                  <Row label="Locked Deposit" value={`${fmtPoolAmount(lockedPlan.deposit)} ${lockedUnit}`} />
                  <Row
                    label="Fixed Ratio"
                    value={
                      lockedPlan.tokensPerQuote
                        ? `1 ${lockedUnit} = ${Math.floor(lockedPlan.tokensPerQuote).toLocaleString()} ${form.symbol.toUpperCase()}`
                        : '—'
                    }
                  />
                  <Row label="You Receive" value={`${Math.floor(lockedPlan.creatorTokens).toLocaleString()} ${form.symbol.toUpperCase()}`} />
                  <Row label="Locked in Pool" value={`${Math.floor(lockedPlan.vaultTokens).toLocaleString()} ${form.symbol.toUpperCase()}`} />
                  <Row label="Lock" value="Permanent · unwithdrawable" />
                  <Row label="Vault Reserve" value={`~${vaultXlm} XLM · non-refundable`} />
                  {lockedQuote === 'usdc' && !usdcTrustline && <Row label="USDC Trustline" value="Added in this launch" />}
                </>
              ) : (
                <>
                  <Row label="Liquidity" value={`${liquidity}%`} />
                  <Row label="Keep" value={`${100 - liquidity}%`} />
                  <Row label="Price Curve" value={curvePreset.label} />
                  <Row label="Bonding Rungs" value={`${curvePreset.rungs} rungs · ${curvePreset.priceStep}× step`} />
                  {initialLiquidity && <Row label="Initial Liquidity" value={`${initialLiquidity} XLM → Pool`} />}
                </>
              )}
              {imageFile && <Row label="Logo" value="✓ Uploaded" />}
            </div>
            <div className="border-t border-white/5 pt-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Network Fee</span>
                <span className="text-white/80">~{cost.feeXlm.toFixed(5)} XLM</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Reserve (refundable)</span>
                <span className="text-white/80">~{cost.reserveXlm.toFixed(1)} XLM</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Issuer Reserve (non-refundable)</span>
                <span className="text-white/80">~{cost.issuerReserveXlm} XLM</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/40">Bonding Rungs</span>
                <span className="text-white/80">{autoPool ? '— (pool mode)' : `${cost.offerCount} sell offers`}</span>
              </div>
              {(autoPool || initialLiquidity) && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Pool Setup</span>
                  <span className="text-white/80">{cost.poolOps} ops</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-3">
            <p className="text-xs text-white/60">
              A dedicated issuing account is created and permanently locked to ensure fixed supply. Your
              wallet establishes a trustline and receives the personal portion directly.
            </p>
          </div>

          <div className="bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-xl p-3">
            <p className="text-xs text-white/60">
              ⚠ This is a real Stellar mainnet transaction. Your wallet will charge real XLM and the
              operation is irreversible.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('form')}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleNewLaunch}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
            >
              {loading ? 'Launching…' : 'Confirm & Launch'}
            </button>
          </div>
        </div>
      ) : step === 'progress' && attempt ? (
        <div className="p-4 space-y-3">
          <LaunchStepTracker steps={STEPS} currentStep={attempt.step} statuses={stepStatuses} />

          {waiting && !retrying && (
            <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-3 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-sm text-white/80">Waiting for your wallet… Approve the transaction in your wallet app to continue.</p>
            </div>
          )}

          {retrying && (
            <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-3 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-sm text-white/80">Retrying — re-reading the network and trying again…</p>
            </div>
          )}

          <div className="bg-[#141518] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{attempt.step_label || 'Working…'}</span>
              {stepStatuses[attempt.step] === 'failed' ? (
                <span className="text-xs text-[#ff3b5c] font-bold">Failed</span>
              ) : stepStatuses[attempt.step] === 'done' ? (
                <span className="text-xs text-[#00ff88]">Done</span>
              ) : (
                <span className="text-xs text-[#00ff88]">In progress</span>
              )}
            </div>
            {attempt.error && <p className="text-xs text-[#ff3b5c]">{attempt.error}</p>}
            {attempt.error_code && <p className="text-[10px] text-white/30">Code: {attempt.error_code}</p>}
            {showResume && progressAnalysis && availableXlm != null && (
              <p className="text-xs text-white/40">Required ~{progressAnalysis.required.toFixed(2)} XLM · Available {availableXlm.toFixed(2)} XLM</p>
            )}
          </div>

          <div className="bg-[#141518] rounded-2xl p-4 space-y-2 text-sm">
            <Row label="Asset" value={`$${attempt.symbol}`} />
            <Row
              label="Mode"
              value={
                attempt.launch_model === 'locked'
                  ? 'Locked Liquidity'
                  : attempt.auto_pool
                  ? '100% Auto-Pool'
                  : `Bonding Curve · ${attempt.liquidity}%`
              }
            />
            <Row
              label="Pool"
              value={POOL_TYPES.find((p) => p.value === (attempt.pool_type || 'xlm'))?.label || 'Single Pool (XLM)'}
            />
            <Row label="Supply" value={Math.floor(parseFloat(attempt.supply) || 0).toLocaleString()} />
            {attempt.issuer_public_key && (
              <Row label="Issuer" value={`${attempt.issuer_public_key.slice(0, 8)}…${attempt.issuer_public_key.slice(-4)}`} />
            )}
          </div>

          <div className="flex gap-2">
            {showResume ? (
              <button
                onClick={handleRetry}
                disabled={loading}
                className="flex-1 py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
              >
                Resume
              </button>
            ) : (
              <button
                onClick={handleAbort}
                disabled={loading}
                className="flex-1 py-3.5 rounded-xl bg-white/5 text-white font-bold text-sm disabled:opacity-50"
              >
                {loading ? 'Running…' : 'Cancel (progress saved)'}
              </button>
            )}
          </div>

          <p className="text-xs text-white/40 text-center">
            Your progress is saved automatically. You can close this page and resume safely later.
          </p>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="bg-[#141518] rounded-2xl p-4">
            <h3 className="font-bold mb-1">Upload your stellar.toml</h3>
            <p className="text-xs text-white/40 mb-3">
              Copy this content and save it as{' '}
              <code className="text-[#00ff88]">.well-known/stellar.toml</code> on your domain{' '}
              <span className="text-white/70">{effectiveDomain}</span>.
            </p>
            <pre className="bg-black/40 rounded-xl p-3 text-xs text-white/80 overflow-x-auto whitespace-pre-wrap break-all max-h-72">
              {tomlText}
            </pre>
            <button
              onClick={() => {
                navigator.clipboard.writeText(tomlText);
                toast({ title: 'Copied to clipboard!' });
              }}
              className="w-full mt-3 py-3 rounded-xl bg-[#00ff88] text-black font-bold text-sm"
            >
              Copy to Clipboard
            </button>
            <ShareButton
              className="mt-2"
              payload={launchShare({ id: tokenId, symbol: form.symbol.toUpperCase(), name: form.name })}
              label="Share your launch"
            />
            <button
              onClick={() => navigate(`/token/${tokenId}`)}
              className="w-full mt-2 py-3 rounded-xl bg-white/5 text-white font-bold text-sm"
            >
              View Token
            </button>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/40">{label}</span>
      <span className="font-medium text-white/90">{value}</span>
    </div>
  );
}