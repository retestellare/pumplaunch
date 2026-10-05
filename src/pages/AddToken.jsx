import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, Loader2, Search as SearchIcon } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { useToast } from '@/components/ui/use-toast';
import { useWallet } from '@/lib/wallet';
import { parseAssetQuery, searchAssets, loadAssetPreview, findListedToken, listAsset } from '@/lib/assetLookup';
import AssetCandidate from '@/components/addtoken/AssetCandidate';
import AssetPreviewCard from '@/components/addtoken/AssetPreviewCard';

const FORMATS = [
  ['CODE:ISSUER', 'the exact asset, e.g. USDC:GA5Z…'],
  ['CODE', 'every asset using that code'],
  ['G… address', 'every asset that account issues'],
];

export default function AddToken() {
  const goBack = useGoBack('/');
  const { toast } = useToast();
  const { wallet } = useWallet();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [state, setState] = useState('idle'); // idle | searching | candidates | preview | notFound
  const [candidates, setCandidates] = useState([]);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [listed, setListed] = useState(null);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');

  const select = async (asset) => {
    setState('preview');
    setPreviewLoading(true);
    setPreview(null);
    setListed(null);
    try {
      const [detail, existing] = await Promise.all([loadAssetPreview(asset), findListedToken(asset)]);
      setPreview(detail);
      setListed(existing);
    } catch (e) {
      setMessage(e?.message || 'Could not read this asset from the network.');
      setState('notFound');
    }
    setPreviewLoading(false);
  };

  const search = async (e) => {
    e.preventDefault();
    const parsed = parseAssetQuery(query);
    if (!parsed) {
      toast({
        title: 'Check the format',
        description: 'Use CODE:ISSUER, a code on its own, or an issuer address starting with G.',
        variant: 'destructive',
      });
      return;
    }

    setState('searching');
    setPreview(null);
    setCandidates([]);
    setListed(null);
    setMessage('');
    try {
      const found = await searchAssets(parsed);
      if (found.length === 0) {
        setMessage(
          parsed.code && parsed.issuer
            ? `No asset ${parsed.code} is issued by that account.`
            : parsed.issuer
            ? 'That account issues no assets.'
            : `No asset uses the code ${parsed.code}.`
        );
        setState('notFound');
        return;
      }
      if (found.length === 1) {
        await select(found[0]);
        return;
      }
      setCandidates(found);
      setState('candidates');
    } catch (err) {
      setMessage(err?.message || 'The Stellar network could not be reached.');
      setState('notFound');
    }
  };

  const add = async () => {
    setAdding(true);
    try {
      const token = listed || (await listAsset(preview, wallet?.address));
      toast({ title: `$${token.symbol} is now in the app` });
      navigate(`/token/${token.id}`);
    } catch (err) {
      toast({
        title: 'Could not add this token',
        description: err?.message || 'Try again in a moment.',
        variant: 'destructive',
      });
    }
    setAdding(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <button onClick={goBack} aria-label="Back" className="text-white/70">
            <ChevronLeft size={22} />
          </button>
          <span className="font-bold">Add a Token</span>
        </div>
      </header>

      <main className="p-4 space-y-4">
        <form onSubmit={search} className="bg-[#141518] rounded-2xl p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold">Find a Stellar token</h2>
            <p className="text-[10px] text-white/30 mt-0.5">
              Any token on mainnet can be listed here — paste its code and issuer
            </p>
          </div>

          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="AQUA or AQUA:GBNZ…"
              autoCapitalize="characters"
              className="flex-1 min-w-0 bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={state === 'searching' || !query.trim()}
              className="px-4 rounded-xl bg-[#00ff88] text-black font-bold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {state === 'searching' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <SearchIcon size={16} />
              )}
              Find
            </button>
          </div>

          <div className="space-y-0.5">
            {FORMATS.map(([format, hint]) => (
              <p key={format} className="text-[10px] text-white/30">
                · <span className="text-white/50 font-mono">{format}</span> — {hint}
              </p>
            ))}
          </div>
        </form>

        {state === 'notFound' && (
          <div className="bg-[#ff3b5c]/5 border border-[#ff3b5c]/20 rounded-2xl p-4 flex gap-3">
            <AlertCircle size={18} className="text-[#ff3b5c] shrink-0" />
            <div>
              <p className="text-sm font-bold text-[#ff3b5c]">No token found</p>
              <p className="text-xs text-white/60 mt-1">{message}</p>
              <p className="text-[10px] text-white/30 mt-2">
                A Stellar asset is identified by its code plus the account that issues it — check both
                on a mainnet explorer.
              </p>
            </div>
          </div>
        )}

        {state === 'candidates' && (
          <div className="bg-[#141518] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <h3 className="text-sm font-bold">{candidates.length} matches</h3>
              <p className="text-[10px] text-white/30 mt-0.5">
                Codes are not unique on Stellar — pick the issuer you meant
              </p>
            </div>
            {candidates.map((c) => (
              <AssetCandidate key={`${c.code}:${c.issuer}`} asset={c} onSelect={() => select(c)} />
            ))}
          </div>
        )}

        {state === 'preview' &&
          (previewLoading ? (
            <div className="bg-[#141518] rounded-2xl p-10 flex justify-center">
              <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
            </div>
          ) : (
            preview && (
              <AssetPreviewCard
                asset={preview}
                listed={!!listed}
                busy={adding}
                onAdd={add}
                onBack={candidates.length ? () => setState('candidates') : null}
              />
            )
          ))}
      </main>
    </div>
  );
}