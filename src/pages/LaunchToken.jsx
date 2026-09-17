import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import {
  loadAccount,
  buildLaunchTransaction,
  signAndSubmit,
  generateStellarToml,
  estimateLaunchCost,
  HOME_DOMAIN,
} from '@/lib/stellar';
import { ImagePlus } from 'lucide-react';

const DISTRIBUTION_OPTIONS = [
  { value: 100, label: '100% Liquidity', desc: 'All tokens seeded to the DEX bonding curve' },
  { value: 80, label: '80 / 20', desc: 'Keep 20% in your wallet, seed 80% to the DEX' },
  { value: 50, label: '50 / 50', desc: 'Keep 50% in your wallet, seed 50% to the DEX' },
];

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
  const [step, setStep] = useState('form');
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [tomlText, setTomlText] = useState('');
  const [tokenId, setTokenId] = useState(null);

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
    const supply = parseFloat(form.supply);
    if (!supply || supply <= 0) {
      toast({ title: 'Enter a valid supply', variant: 'destructive' });
      return false;
    }
    if (form.customDomain) {
      const cleaned = cleanDomain(form.customDomain);
      if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(cleaned)) {
        toast({ title: 'Invalid domain format (e.g. mytoken.com)', variant: 'destructive' });
        return false;
      }
    }
    return true;
  };

  const review = () => {
    if (!validate()) return;
    setStep('confirm');
  };

  const launch = async () => {
    setLoading(true);
    try {
      const supply = parseFloat(form.supply);
      const sym = form.symbol.toUpperCase();
      const customDomain = form.customDomain ? cleanDomain(form.customDomain) : '';
      const homeDomain = customDomain || HOME_DOMAIN;

      let imageUrl = null;
      if (imageFile) {
        const uploadResult = await base44.integrations.Core.UploadPublicFile({ file: imageFile });
        imageUrl = uploadResult.file_url;
      }

      const account = await loadAccount(wallet.address);
      if (!account) {
        toast({
          title: 'Account not found',
          description: 'Fund your wallet with XLM on Stellar mainnet first.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { transaction, issuerPublicKey } = buildLaunchTransaction({
        sourceAccount: account,
        assetCode: sym,
        totalSupply: supply,
        liquidityPercent: liquidity,
        homeDomain,
      });
      await signAndSubmit(transaction);

      const toml = generateStellarToml({
        name: form.name,
        code: sym,
        issuer: issuerPublicKey,
        description: form.description,
        logoUrl: imageUrl,
        orgUrl: customDomain ? `https://${customDomain}` : `https://${HOME_DOMAIN}`,
      });

      const t = await base44.entities.Token.create({
        name: form.name,
        symbol: sym,
        description: form.description,
        image_url: imageUrl,
        creator: wallet.address,
        issuer: issuerPublicKey,
        asset_code: sym,
        home_domain: homeDomain,
        custom_domain: customDomain || null,
        supply,
        liquidity_percent: liquidity,
        toml_content: toml,
        price: 0.000001,
        market_cap: 0.000001 * supply,
        holders: 1,
        volume_24h: 0,
        change_24h: 0,
        is_graduated: false,
      });

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
  };

  const cost = estimateLaunchCost(liquidity);
  const effectiveDomain = form.customDomain ? cleanDomain(form.customDomain) : HOME_DOMAIN;

  return (
    <PageLayout title="Launch Token" rightAction={<WalletButton />}>
      {step === 'form' ? (
        <div className="p-4 space-y-4">
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
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">Total Supply</label>
              <input
                type="number"
                value={form.supply}
                onChange={(e) => setForm({ ...form, supply: e.target.value })}
                className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
              />
            </div>

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
              {DISTRIBUTION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLiquidity(opt.value)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition ${
                    liquidity === opt.value
                      ? 'border-[#00ff88] bg-[#00ff88]/5'
                      : 'border-white/5 bg-[#141518]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm">{opt.label}</span>
                    {liquidity === opt.value && <span className="text-[#00ff88] text-xs">✓</span>}
                  </div>
                  <div className="text-xs text-white/40 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={review}
            disabled={!wallet}
            className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
          >
            {wallet ? 'Review Launch' : 'Connect Wallet First'}
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
              <Row label="Total Supply" value={parseFloat(form.supply).toLocaleString()} />
              <Row label="Liquidity" value={`${liquidity}%`} />
              <Row label="Keep" value={`${100 - liquidity}%`} />
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
                <span className="text-white/80">{cost.offerCount} sell offers</span>
              </div>
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
              onClick={launch}
              disabled={loading}
              className="flex-1 py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
            >
              {loading ? 'Launching…' : 'Confirm & Launch'}
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