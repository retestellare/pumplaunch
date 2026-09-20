import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
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
} from '@/lib/stellar';
import {
  saveLaunchAttempt,
  clearLaunchAttempt,
  getLaunchAttemptForWallet,
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
  const [loadingStep, setLoadingStep] = useState('');
  const [availableXlm, setAvailableXlm] = useState(null);
  const [resumeAttempt, setResumeAttempt] = useState(null);

  // Load wallet's available XLM for the balance gate
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

  // Detect a saved incomplete launch for this wallet
  useEffect(() => {
    if (wallet?.address) {
      setResumeAttempt(getLaunchAttemptForWallet(wallet.address));
    } else {
      setResumeAttempt(null);
    }
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

  const runLaunch = async (attempt) => {
    setLoading(true);
    try {
      const sym = attempt.form.symbol.toUpperCase();
      const supply = attempt.autoPool
        ? parseFloat(attempt.initialLiquidity) / BASE_PRICE
        : parseFloat(attempt.form.supply);
      const customDomain = attempt.form.customDomain ? cleanDomain(attempt.form.customDomain) : '';
      const homeDomain = customDomain || HOME_DOMAIN;

      // Upload logo once (skip if already uploaded)
      if (!attempt.imageUrl && imageFile) {
        const uploadResult = await base44.integrations.Core.UploadPublicFile({ file: imageFile });
        attempt.imageUrl = uploadResult.file_url;
        saveLaunchAttempt(attempt);
      }
      const imageUrl = attempt.imageUrl;

      const account = await loadAccount(wallet.address);
      if (!account) {
        toast({
          title: 'Account not found',
          description: 'Fund your wallet with XLM on Stellar mainnet first.',
          variant: 'destructive',
        });
        setLoading(false);
        setLoadingStep('');
        return;
      }

      // Verify on-chain progress to skip completed steps
      const progress = attempt.issuerPublicKey
        ? await verifyLaunchProgress({
            walletAddress: wallet.address,
            issuerPublicKey: attempt.issuerPublicKey,
            assetCode: sym,
            isAutoPool: attempt.autoPool,
          })
        : { issuerExists: false, trustlineExists: false, tokensIssued: false, liquidityExists: false };

      let issuerKeypair;
      let issuerPublicKey;

      // Step 1: Create issuer account + trustline
      if (progress.issuerExists && attempt.issuerSecret && attempt.issuerPublicKey) {
        issuerKeypair = keypairFromSecret(attempt.issuerSecret);
        issuerPublicKey = attempt.issuerPublicKey;
      } else {
        setLoadingStep('Creating issuer account…');
        const { transaction: setupTx, issuerKeypair: kp, issuerPublicKey: pk } = buildLaunchSetupTransaction({
          sourceAccount: account,
          assetCode: sym,
          homeDomain,
        });
        await signAndSubmit(setupTx);
        attempt.issuerSecret = kp.secret();
        attempt.issuerPublicKey = pk;
        attempt.step = 'issuer';
        saveLaunchAttempt(attempt);
        issuerKeypair = kp;
        issuerPublicKey = pk;
        await new Promise((r) => setTimeout(r, 5000));
      }

      // Step 2: Issue tokens (setOptions lock + payment)
      if (!progress.tokensIssued) {
        setLoadingStep('Issuing tokens…');
        const issuerAccount = await loadAccount(issuerPublicKey);
        if (!issuerAccount) throw new Error('Issuer account not found after creation');
        const issueTx = buildIssuerSetupTransaction({
          issuerAccount,
          userAddress: wallet.address,
          assetCode: sym,
          totalSupply: supply,
          homeDomain,
        });
        await submitProgrammatically(issueTx, issuerKeypair);
        attempt.step = 'issue';
        saveLaunchAttempt(attempt);
        await new Promise((r) => setTimeout(r, 5000));
      }

      // Step 3: Seed liquidity
      const progress2 = await verifyLaunchProgress({
        walletAddress: wallet.address,
        issuerPublicKey,
        assetCode: sym,
        isAutoPool: attempt.autoPool,
      });
      if (!progress2.liquidityExists) {
        setLoadingStep('Seeding liquidity…');
        const userAccount = await loadAccount(wallet.address);

        if (attempt.autoPool) {
          const xlmAmount = parseFloat(attempt.initialLiquidity);
          const tokenAmount = supply;
          const poolTx = buildPoolSetupTransaction({
            sourceAccount: userAccount,
            assetCode: sym,
            issuer: issuerPublicKey,
            xlmAmount,
            tokenAmount,
          });
          await signAndSubmit(poolTx);
        } else {
          const liquidityAmount = (supply * attempt.liquidity) / 100;
          if (liquidityAmount > 0) {
            const curvePreset = CURVE_PRESETS[attempt.curve];
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
          if (attempt.initialLiquidity) {
            const xlmAmount = parseFloat(attempt.initialLiquidity);
            const tokenAmount = xlmAmount / BASE_PRICE;
            const poolTx = buildPoolSetupTransaction({
              sourceAccount: userAccount,
              assetCode: sym,
              issuer: issuerPublicKey,
              xlmAmount,
              tokenAmount,
            });
            await signAndSubmit(poolTx);
          }
        }
        attempt.step = 'pool';
        saveLaunchAttempt(attempt);
      }

      // Step 4: Create DB record
      setLoadingStep('Finalizing…');
      const toml = generateStellarToml({
        name: attempt.form.name,
        code: sym,
        issuer: issuerPublicKey,
        description: attempt.form.description,
        logoUrl: imageUrl,
        orgUrl: customDomain ? `https://${customDomain}` : `https://${HOME_DOMAIN}`,
      });

      let t;
      if (attempt.tokenId) {
        t = { id: attempt.tokenId };
      } else {
        const existing = await base44.entities.Token.filter({ issuer: issuerPublicKey, asset_code: sym });
        if (existing && existing.length > 0) {
          t = existing[0];
        } else {
          t = await base44.entities.Token.create({
            name: attempt.form.name,
            symbol: sym,
            description: attempt.form.description,
            image_url: imageUrl,
            creator: wallet.address,
            issuer: issuerPublicKey,
            asset_code: sym,
            home_domain: homeDomain,
            custom_domain: customDomain || null,
            supply,
            liquidity_percent: attempt.liquidity,
            curve: attempt.curve,
            toml_content: toml,
            price: 0.000001,
            market_cap: 0.000001 * supply,
            holders: 1,
            volume_24h: 0,
            change_24h: 0,
            is_graduated: false,
            is_auto_pool: attempt.autoPool,
          });
        }
        attempt.tokenId = t.id;
        attempt.tomlText = toml;
        attempt.step = 'db';
        saveLaunchAttempt(attempt);
      }

      // Done — clear saved state
      clearLaunchAttempt();
      setResumeAttempt(null);
      setTokenId(t.id);

      if (customDomain) {
        setTomlText(toml);
        setStep('toml');
        toast({ title: `$${sym} launched! Upload your toml next.` });
      } else {
        toast({ title: `$${sym} launched on mainnet!` });
        navigate(`/token/${t.id}`);
      }
    } catch (e) {
      toast({ title: 'Launch failed', description: e.message || String(e), variant: 'destructive' });
    }
    setLoading(false);
    setLoadingStep('');
  };

  const handleNewLaunch = () => {
    clearLaunchAttempt();
    setResumeAttempt(null);
    const attempt = {
      walletAddress: wallet.address,
      form: { ...form },
      liquidity,
      autoPool,
      initialLiquidity,
      curve,
      issuerSecret: null,
      issuerPublicKey: null,
      imageUrl: null,
      step: 'start',
      tokenId: null,
      tomlText: null,
    };
    runLaunch(attempt);
  };

  const handleResume = async () => {
    const attempt = resumeAttempt;
    if (!attempt) return;
    setForm(attempt.form);
    setLiquidity(attempt.liquidity);
    setAutoPool(attempt.autoPool);
    setInitialLiquidity(attempt.initialLiquidity);
    setCurve(attempt.curve);
    setStep('confirm');
    await runLaunch(attempt);
  };

  const handleDiscard = () => {
    clearLaunchAttempt();
    setResumeAttempt(null);
    toast({
      title: 'Incomplete launch discarded',
      description: 'The 2 XLM issuer reserve cannot be recovered.',
    });
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

  return (
    <PageLayout title="Launch Token" rightAction={<WalletButton />}>
      {step === 'form' ? (
        <div className="p-4 space-y-4">
          {resumeAttempt && (
            <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-sm font-bold">Incomplete launch detected</p>
                <p className="text-xs text-white/40 mt-0.5">
                  ${resumeAttempt.form.symbol} · last step: {resumeAttempt.step}
                </p>
                <p className="text-xs text-white/40 mt-1">
                  Resume to finish without spending another 2 XLM issuer reserve.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleResume}
                  className="flex-1 py-2.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm"
                >
                  Resume
                </button>
                <button
                  onClick={handleDiscard}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-white font-bold text-sm"
                >
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
                    curve === opt.value
                      ? 'border-[#00ff88] bg-[#00ff88]/5'
                      : 'border-white/5 bg-[#141518]'
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
              {loading ? (loadingStep || 'Launching…') : 'Confirm & Launch'}
            </button>
          </div>
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