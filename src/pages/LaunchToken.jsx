import { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import LaunchStepTracker, { STEPS } from '@/components/LaunchStepTracker';
import {
  loadAccount,
  parseBalances,
  buildLaunchSetupTransaction,
  buildIssuerSetupTransaction,
  buildBondingCurveTransaction,
  buildPoolSetupTransaction,
  verifyLaunchProgress,
  keypairFromSecret,
  BASE_PRICE,
  submitProgrammatically,
  signAndSubmit,
  generateStellarToml,
  estimateLaunchCost,
  CURVE_PRESETS,
  HOME_DOMAIN,
  pollForAccount,
  pollForTransaction,
  findExistingTrustline,
  fetchTokenMetadata,
} from '@/lib/stellar';
import {
  saveLaunchAttempt,
  getCurrentLaunchAttempt,
  clearLaunchAttempt,
  listLaunchAttempts,
} from '@/lib/launchState';
import { ImagePlus } from 'lucide-react';

const DISTRIBUTION_OPTIONS = [
  { value: 100, label: '100% Liquidity', desc: 'All tokens seeded to the DEX bonding curve' },
  { value: 80, label: '80 / 20', desc: 'Keep 20% in your wallet, seed 80% to the DEX' },
  { value: 50, label: '50 / 50', desc: 'Keep 50% in your wallet, seed 50% to the DEX' },
  { value: 'auto_pool', label: '100% Auto-Pool', desc: '100% of XLM from purchases goes directly into the Stellar Liquidity Pool to automatically support liquidity.' },
];

const CURVE_OPTIONS = Object.entries(CURVE_PRESETS).map(([key, p]) => ({
  value: key,
  label: p.label,
  desc: p.desc,
  rungs: p.rungs,
  step: p.priceStep,
}));

const MAX_IMAGE_SIZE = 2 * 1024 * 1024;

function cleanDomain(d) {
  return d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase().trim();
}

function analyzeStall(attempt, availableXlm) {
  const curvePreset = CURVE_PRESETS[attempt.curve] || CURVE_PRESETS.slow;
  const cost = estimateLaunchCost({
    liquidityPercent: attempt.liquidity,
    rungs: curvePreset.rungs,
    autoPool: attempt.autoPool,
    hasInitialLiquidity: !!(attempt.initialLiquidity && parseFloat(attempt.initialLiquidity) >= 10),
  });
  const poolDeposit = attempt.autoPool
    ? parseFloat(attempt.initialLiquidity) || 0
    : attempt.initialLiquidity
    ? parseFloat(attempt.initialLiquidity) || 0
    : 0;
  const issuerReserve = attempt.issuerPublicKey ? 0 : cost.issuerReserveXlm;
  const required = issuerReserve + poolDeposit + cost.feeXlm + cost.reserveXlm;
  const insufficient = availableXlm != null && availableXlm < required;
  let reason = attempt.error;
  if (!reason) reason = insufficient ? 'Insufficient XLM to finish the launch.' : 'Launch was interrupted.';
  return { required, insufficient, reason };
}

export default function LaunchToken() {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', symbol: '', description: '', supply: '1000000000', customDomain: '' });
  const [liquidity, setLiquidity] = useState(100);
  const [autoPool, setAutoPool] = useState(false);
  const [initialLiquidity, setInitialLiquidity] = useState('');
  const [curve, setCurve] = useState('slow');
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tomlText, setTomlText] = useState('');
  const [tokenId, setTokenId] = useState(null);
  const [availableXlm, setAvailableXlm] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [stepStatuses, setStepStatuses] = useState({});
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!wallet?.address) {
      setAvailableXlm(null);
      return;
    }
    let active = true;
    (async () => {
      try {
        const account = await loadAccount(wallet.address);
        if (!active) return;
        setAvailableXlm(account ? parseBalances(account).availableXlm : 0);
      } catch {
        if (active) setAvailableXlm(0);
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet?.address]);

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
    if (!form.name.trim() || !form.symbol.trim()) {
      toast({ title: 'Name and symbol are required', variant: 'destructive' });
      return false;
    }
    const sym = form.symbol.toUpperCase();
    if (sym.length < 4 || sym.length > 12 || !/^[A-Z0-9]+$/.test(sym)) {
      toast({ title: 'Symbol must be 4-12 alphanumeric characters', variant: 'destructive' });
      return false;
    }
    if (!autoPool) {
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
    const il = parseFloat(initialLiquidity);
    if (autoPool) {
      if (!il || il < 10) {
        toast({ title: 'Initial Liquidity must be at least 10 XLM for Auto-Pool', variant: 'destructive' });
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

  const runLaunch = async (store) => {
    store = { ...store, error: null };
    setStep('progress');
    setAttempt({ ...store });
    setStepStatuses({});
    setWaiting(false);
    setLoading(true);

    const sym = store.symbol.toUpperCase();
    const customDomain = store.customDomain ? cleanDomain(store.customDomain) : '';
    const homeDomain = customDomain || HOME_DOMAIN;
    store.symbol = sym;

    const setStage = (stepId, label) => {
      store.step = stepId;
      store.stepLabel = label;
      setAttempt({ ...store });
      saveLaunchAttempt(store);
    };

    try {
      if (!store.imageUrl && imageFile) {
        setStage('issuer', 'Uploading logo…');
        const uploadResult = await base44.integrations.Core.UploadPublicFile({ file: imageFile });
        store.imageUrl = uploadResult.file_url;
        saveLaunchAttempt(store);
      }

      const account = await loadAccount(wallet.address);
      if (!account) {
        toast({ title: 'Account not found', description: 'Fund your wallet with XLM on Stellar mainnet first.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      // Reuse an existing on-chain trustline for this symbol (no duplicate issuer)
      if (!store.issuerPublicKey) {
        const existingIssuer = await findExistingTrustline(wallet.address, sym);
        if (existingIssuer) {
          store.issuerPublicKey = existingIssuer;
          store.issuerSecret = null;
          store.reusedAsset = true;
          saveLaunchAttempt(store);
          setAttempt({ ...store });
          toast({ title: `Existing $${sym} found`, description: 'Reusing the token you already hold — no new trustline created.' });
        }
      }

      const issuerPublicKey = store.issuerPublicKey;
      const supply = store.reusedAsset
        ? parseFloat(store.supply) || 0
        : store.autoPool
        ? parseFloat(store.initialLiquidity) / BASE_PRICE
        : parseFloat(store.supply);
      store.supply = supply;

      // Step 1: Create issuer account + trustline
      setStage('issuer', store.reusedAsset ? 'Existing token — skipped' : 'Creating issuer account…');
      if (store.reusedAsset) {
        setStepStatus('issuer', 'done');
      } else {
        const progress = issuerPublicKey
          ? await verifyLaunchProgress({ walletAddress: wallet.address, issuerPublicKey, assetCode: sym, isAutoPool: store.autoPool })
          : { trustlineExists: false, tokensIssued: false, liquidityExists: false };
        if (progress.trustlineExists) {
          setStepStatus('issuer', 'done');
        } else {
          setWaiting(true);
          setStage('issuer', 'Waiting for your wallet…');
          const { transaction: setupTx, issuerKeypair: kp, issuerPublicKey: pk } = buildLaunchSetupTransaction({
            sourceAccount: account,
            assetCode: sym,
            homeDomain,
          });
          try {
            await signAndSubmit(setupTx);
            store.issuerSecret = kp.secret();
            store.issuerPublicKey = pk;
            saveLaunchAttempt(store);
            setAttempt({ ...store });
            await pollForAccount(pk);
          } catch (e) {
            setStepStatus('issuer', 'failed');
            setAttempt((a) => ({ ...a, error: e.message }));
            throw e;
          } finally {
            setWaiting(false);
          }
          setStage('issuer', 'Issuer account created');
          setStepStatus('issuer', 'done');
        }
      }

      // Step 2: Issue tokens
      setStage('issue', store.reusedAsset ? 'Existing token — skipped' : 'Issuing tokens…');
      if (store.reusedAsset) {
        setStepStatus('issue', 'done');
      } else {
        const p2 = await verifyLaunchProgress({ walletAddress: wallet.address, issuerPublicKey, assetCode: sym, isAutoPool: store.autoPool });
        if (p2.tokensIssued) {
          setStepStatus('issue', 'done');
        } else {
          if (!store.issuerSecret) throw new Error('Issuer key unavailable — resume to retry issuing.');
          const issuerKeypair = keypairFromSecret(store.issuerSecret);
          const issuerAccount = await loadAccount(issuerPublicKey);
          if (!issuerAccount) throw new Error('Issuer account not found after creation');
          const issueTx = buildIssuerSetupTransaction({
            issuerAccount,
            userAddress: wallet.address,
            assetCode: sym,
            totalSupply: supply,
            homeDomain,
          });
          try {
            const result = await submitProgrammatically(issueTx, issuerKeypair);
            await pollForTransaction(result);
          } catch (e) {
            setStepStatus('issue', 'failed');
            setAttempt((a) => ({ ...a, error: e.message }));
            throw e;
          }
          saveLaunchAttempt(store);
          setAttempt({ ...store });
          setStage('issue', 'Tokens issued');
          setStepStatus('issue', 'done');
        }
      }

      // Step 3: Seed liquidity
      setStage('liquidity', store.reusedAsset ? 'Existing token — skipped' : 'Seeding liquidity…');
      if (store.reusedAsset) {
        setStepStatus('liquidity', 'done');
      } else {
        const p3 = await verifyLaunchProgress({ walletAddress: wallet.address, issuerPublicKey, assetCode: sym, isAutoPool: store.autoPool });
        if (!p3.liquidityExists) {
          const userAccount = await loadAccount(wallet.address);
          setWaiting(true);
          try {
            if (store.autoPool) {
              const xlmAmount = parseFloat(store.initialLiquidity);
              const poolTx = buildPoolSetupTransaction({ sourceAccount: userAccount, assetCode: sym, issuer: issuerPublicKey, xlmAmount, tokenAmount: supply });
              await signAndSubmit(poolTx);
            } else {
              const liquidityAmount = (supply * store.liquidity) / 100;
              if (liquidityAmount > 0) {
                const curvePreset = CURVE_PRESETS[store.curve];
                const bondingTx = buildBondingCurveTransaction({
                  userAccount,
                  assetCode: sym,
                  issuerPublicKey,
                  liquidityAmount,
                  rungs: curvePreset.rungs,
                  priceStep: curvePreset.priceStep,
                });
                await signAndSubmit(bondingTx);
              }
              if (store.initialLiquidity) {
                const xlmAmount = parseFloat(store.initialLiquidity);
                const tokenAmount = xlmAmount / BASE_PRICE;
                const poolTx = buildPoolSetupTransaction({ sourceAccount: userAccount, assetCode: sym, issuer: issuerPublicKey, xlmAmount, tokenAmount });
                await signAndSubmit(poolTx);
              }
            }
          } catch (e) {
            setStepStatus('liquidity', 'failed');
            setAttempt((a) => ({ ...a, error: e.message }));
            throw e;
          } finally {
            setWaiting(false);
          }
        }
        setStage('liquidity', 'Liquidity seeded');
        setStepStatus('liquidity', 'done');
      }

      // Step 4: List in app
      setStage('list', 'Listing in app…');
      if (store.reusedAsset && (!store.imageUrl || store.name === store.symbol)) {
        try {
          const meta = await fetchTokenMetadata(sym, issuerPublicKey);
          if (meta) {
            if (meta.logo && !store.imageUrl) store.imageUrl = meta.logo;
            if (meta.name) store.name = meta.name;
            saveLaunchAttempt(store);
            setAttempt({ ...store });
          }
        } catch {
          /* metadata optional */
        }
      }
      if (!store.tokenId) {
        const existing = await base44.entities.Token.filter({ issuer: issuerPublicKey, asset_code: sym });
        if (existing && existing.length > 0) {
          store.tokenId = existing[0].id;
        } else {
          const toml = generateStellarToml({
            name: store.name,
            code: sym,
            issuer: issuerPublicKey,
            description: store.description,
            logoUrl: store.imageUrl,
            orgUrl: customDomain ? `https://${customDomain}` : `https://${HOME_DOMAIN}`,
          });
          const record = {
            name: store.name,
            symbol: sym,
            description: store.description,
            image_url: store.imageUrl,
            creator: wallet.address,
            issuer: issuerPublicKey,
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
            is_auto_pool: store.autoPool,
          };
          let created;
          try {
            created = await base44.entities.Token.create(record);
          } catch {
            await new Promise((r) => setTimeout(r, 1500));
            created = await base44.entities.Token.create(record);
          }
          store.tokenId = created.id;
          store.tomlText = toml;
          saveLaunchAttempt(store);
          setAttempt({ ...store });
        }
      }
      setStage('list', 'Listed');
      setStepStatus('list', 'done');

      try {
        await base44.entities.Activity.create({
          wallet_address: wallet.address,
          type: 'launch',
          token_symbol: sym,
          token_id: store.tokenId,
          details: store.reusedAsset ? `Listed $${sym}` : `Launched $${sym}`,
        });
      } catch {
        /* ignore */
      }

      clearLaunchAttempt(sym);
      setTokenId(store.tokenId);

      if (customDomain) {
        setTomlText(store.tomlText);
        setStep('toml');
        toast({ title: store.reusedAsset ? `$${sym} listed!` : `$${sym} launched!`, description: 'Upload your toml next.' });
      } else {
        toast({ title: store.reusedAsset ? `$${sym} listed in the app!` : `$${sym} launched on mainnet!` });
        navigate(`/token/${store.tokenId}`);
      }
    } catch (e) {
      toast({
        title: 'Launch step failed',
        description: `${e.message || String(e)}. Your progress is saved — resume safely when ready.`,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setWaiting(false);
    }
  };

  const handleNewLaunch = () => {
    const sym = form.symbol.toUpperCase();
    const existing = getCurrentLaunchAttempt(wallet.address, sym);
    if (existing) {
      runLaunch(existing);
      return;
    }
    const store = {
      walletAddress: wallet.address,
      name: form.name.trim(),
      symbol: sym,
      description: form.description.trim(),
      supply: form.supply,
      customDomain: form.customDomain,
      liquidity,
      autoPool,
      initialLiquidity,
      curve,
      imageUrl: null,
      tomlText: null,
      tokenId: null,
      step: 'start',
      error: null,
    };
    runLaunch(store);
  };

  const handleResume = () => {
    if (!stalledAttempt) return;
    runLaunch(stalledAttempt);
  };

  const handleRetry = () => {
    if (!attempt) return;
    runLaunch(attempt);
  };

  const handleAbort = () => {
    setLoading(false);
    setWaiting(false);
    setStep('form');
  };

  const handleDiscard = () => {
    if (stalledAttempt) clearLaunchAttempt(stalledAttempt.symbol);
    setAttempt(null);
    setStep('form');
    toast({ title: 'Incomplete launch discarded', description: 'The 2 XLM issuer reserve cannot be recovered.' });
  };

  const curvePreset = CURVE_PRESETS[curve];
  const derivedSupply = parseFloat(initialLiquidity) > 0 ? parseFloat(initialLiquidity) / BASE_PRICE : 0;
  const cost = estimateLaunchCost({
    liquidityPercent: liquidity,
    rungs: curvePreset.rungs,
    autoPool,
    hasInitialLiquidity: !!(initialLiquidity && parseFloat(initialLiquidity) >= 10),
  });
  const effectiveDomain = form.customDomain ? cleanDomain(form.customDomain) : HOME_DOMAIN;
  const poolDeposit = autoPool
    ? parseFloat(initialLiquidity) || 0
    : initialLiquidity
    ? parseFloat(initialLiquidity) || 0
    : 0;
  const requiredXlm = cost.issuerReserveXlm + poolDeposit + cost.feeXlm + cost.reserveXlm;
  const balanceOk = availableXlm === null || availableXlm >= requiredXlm;

  const stalledAttempt = useMemo(() => {
    if (!wallet?.address) return null;
    const attempts = listLaunchAttempts().filter(
      (a) => a && a.walletAddress === wallet.address && a.step !== 'done'
    );
    return attempts[0] || null;
  }, [wallet?.address, step]);

  const stallAnalysis = stalledAttempt ? analyzeStall(stalledAttempt, availableXlm) : null;
  const progressAnalysis = attempt ? analyzeStall(attempt, availableXlm) : null;

  return (
    <PageLayout title="Launch Token" rightAction={<WalletButton />}>
      {step === 'form' ? (
        <div className="p-4 space-y-4">
          {stalledAttempt && stallAnalysis && (
            <div className="bg-[#ff3b5c]/5 border border-[#ff3b5c]/30 rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-sm font-bold text-[#ff3b5c]">Incomplete ${stalledAttempt.symbol} launch — stopped</p>
                <p className="text-xs text-white/70 mt-1">{stallAnalysis.reason}</p>
                {availableXlm != null && (
                  <p className="text-xs text-white/40 mt-1">
                    Required to finish: ~{stallAnalysis.required.toFixed(2)} XLM · Available: {availableXlm.toFixed(2)} XLM
                  </p>
                )}
                <p className="text-xs text-white/40 mt-1">Last step: {stalledAttempt.step}. Resume reuses the same issuer — no new trustline or 2 XLM reserve.</p>
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
          )}

          <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Doge Rocket"
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
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
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 font-mono"
              />
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe your memecoin…"
                rows={3}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 resize-none"
              />
            </div>
            {autoPool ? (
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Total Supply (auto)</label>
                <div className="w-full bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl px-3 py-3 font-mono text-sm text-[#00ff88]">
                  {derivedSupply > 0 ? Math.floor(derivedSupply).toLocaleString() : '—'}
                </div>
                <p className="text-[10px] text-white/30 mt-1">Determined by your initial liquidity. More XLM = more tokens, all go to the pool.</p>
              </div>
            ) : (
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Total Supply</label>
                <input
                  type="number"
                  value={form.supply}
                  onChange={(e) => setForm({ ...form, supply: e.target.value })}
                  className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
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
                  <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  <div className="px-3 py-3 bg-black/30 border border-white/5 rounded-xl text-sm text-white/60 text-center hover:bg-white/5 transition">
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
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
              />
              <p className="text-[10px] text-white/30 mt-1">
                Leave empty to host the stellar.toml here. If provided, home_domain is set to your domain and you'll get the toml to upload.
              </p>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-2 block">Supply Distribution</label>
            <div className="space-y-2">
              {DISTRIBUTION_OPTIONS.map((opt) => {
                const selected = opt.value === 'auto_pool' ? autoPool : !autoPool && liquidity === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      if (opt.value === 'auto_pool') {
                        setAutoPool(true);
                      } else {
                        setAutoPool(false);
                        setLiquidity(opt.value);
                      }
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      selected ? 'border-[#00ff88] bg-[#00ff88]/5' : 'border-white/5 bg-[#141518]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{opt.label}</span>
                      {selected && <span className="text-[#00ff88] text-xs">✓</span>}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs text-white/40 mb-2 block">
              Initial Liquidity (XLM){autoPool && <span className="text-[#00ff88]"> · required</span>}
            </label>
            <input
              type="number"
              value={initialLiquidity}
              onChange={(e) => setInitialLiquidity(e.target.value)}
              placeholder={autoPool ? 'Min 10 XLM' : 'Optional (min 10 XLM)'}
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
            />
            <p className="text-[10px] text-white/30 mt-1">Minimum 10 XLM. Recommended 50+ XLM for lower initial price slippage.</p>
          </div>

          {!autoPool && (
            <div>
              <label className="text-xs text-white/40 mb-2 block">Price Curve</label>
              <div className="space-y-2">
                {CURVE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCurve(opt.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                      curve === opt.value ? 'border-[#00ff88] bg-[#00ff88]/5' : 'border-white/5 bg-[#141518]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm">{opt.label}</span>
                      {curve === opt.value && <span className="text-[#00ff88] text-xs">✓</span>}
                    </div>
                    <div className="text-xs text-white/40 mt-0.5">{opt.desc}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">{opt.rungs} rungs · {opt.step}× step</div>
                  </button>
                ))}
              </div>
              {(curve === 'fast' || curve === 'hyper') && (
                <div className="mt-2 bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-xl px-3 py-2">
                  <p className="text-xs text-white/60">⚠ Prices rise sharply after early buys — later buyers pay much more.</p>
                </div>
              )}
            </div>
          )}

          {wallet && availableXlm !== null && !balanceOk && (
            <div className="bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-xl p-3 space-y-1.5">
              <p className="text-xs text-[#ff3b5c] font-bold">Insufficient XLM balance</p>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Available</span>
                <span className="text-white/80">{availableXlm.toFixed(2)} XLM</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Required</span>
                <span className="text-white/80">~{requiredXlm.toFixed(2)} XLM</span>
              </div>
              <p className="text-[10px] text-white/30 mt-1">
                Fund your wallet with at least {(requiredXlm - availableXlm).toFixed(2)} more XLM on Stellar mainnet.
              </p>
            </div>
          )}

          <button
            onClick={review}
            disabled={!wallet || (wallet && availableXlm !== null && !balanceOk)}
            className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
          >
            {!wallet
              ? 'Connect Wallet First'
              : wallet && availableXlm !== null && !balanceOk
              ? 'Insufficient XLM'
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
              <Row label="Total Supply" value={(autoPool ? Math.floor(derivedSupply) : parseFloat(form.supply)).toLocaleString()} />
              {autoPool ? (
                <>
                  <Row label="Mode" value="100% Auto-Pool" />
                  <Row label="Initial Liquidity" value={`${initialLiquidity} XLM`} />
                  <Row label="Market" value="Stellar Liquidity Pool" />
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

          {waiting && (
            <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-xl p-3 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-sm text-white/80">Waiting for your wallet… Approve the transaction in your wallet app to continue.</p>
            </div>
          )}

          <div className="bg-[#141518] rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">{attempt.stepLabel || 'Working…'}</span>
              {stepStatuses[attempt.step] === 'failed' ? (
                <span className="text-xs text-[#ff3b5c] font-bold">Failed</span>
              ) : stepStatuses[attempt.step] === 'done' ? (
                <span className="text-xs text-[#00ff88]">Done</span>
              ) : (
                <span className="text-xs text-[#00ff88]">In progress</span>
              )}
            </div>
            {attempt.error && <p className="text-xs text-[#ff3b5c]">{attempt.error}</p>}
            {stepStatuses[attempt.step] === 'failed' && progressAnalysis && availableXlm != null && (
              <p className="text-xs text-white/40">Required ~{progressAnalysis.required.toFixed(2)} XLM · Available {availableXlm.toFixed(2)} XLM</p>
            )}
          </div>

          <div className="bg-[#141518] rounded-2xl p-4 space-y-2 text-sm">
            <Row label="Asset" value={`$${attempt.symbol}`} />
            <Row label="Mode" value={attempt.autoPool ? '100% Auto-Pool' : `Bonding Curve · ${attempt.liquidity}%`} />
            <Row label="Supply" value={Math.floor(parseFloat(attempt.supply) || 0).toLocaleString()} />
            {attempt.issuerPublicKey && (
              <Row label="Issuer" value={`${attempt.issuerPublicKey.slice(0, 8)}…${attempt.issuerPublicKey.slice(-4)}`} />
            )}
          </div>

          <div className="flex gap-2">
            {stepStatuses[attempt.step] === 'failed' ? (
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