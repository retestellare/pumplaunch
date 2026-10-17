import { useState } from 'react';
import { Search, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Image } from '@/components/ui/image';
import { poolLabel } from '@/lib/pools';
import { shortAddr } from '@/lib/profiles';
import { importExternalToken, lookupExternalToken } from '@/lib/tokenImport';

function fmt(value, decimals = 0) {
  return (parseFloat(value) || 0).toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function Fact({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-[#F2F7F4]/40">{label}</span>
      <span className="font-mono text-[#F2F7F4]/80 truncate">{value}</span>
    </div>
  );
}

function FieldLabel({ children }) {
  return <span className="block text-[10px] tracking-[.06em] uppercase text-[#F2F7F4]/40">{children}</span>;
}

const INPUT_CLASS = 'bg-black/30 border-white/10 text-[#F2F7F4] placeholder:text-[#F2F7F4]/25';

// Listing an asset that already lives on Stellar: the ledger supplies the
// facts, the reviewer only names it and confirms the artwork.
export default function ExternalTokenImport({ wallet }) {
  const [code, setCode] = useState('');
  const [issuer, setIssuer] = useState('');
  const [lookup, setLookup] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const reset = () => {
    setLookup(null);
    setCode('');
    setIssuer('');
    setName('');
    setDescription('');
  };

  const find = async () => {
    setBusy(true);
    setError('');
    setDone('');
    setLookup(null);
    try {
      const found = await lookupExternalToken(code, issuer);
      setLookup(found);
      setName(found.name);
      setDescription('');
    } catch (e) {
      setError(e?.message || String(e));
    }
    setBusy(false);
  };

  const add = async () => {
    setBusy(true);
    setError('');
    try {
      const token = await importExternalToken(
        { ...lookup, name: name.trim() || lookup.asset_code, description },
        wallet
      );
      setDone(`$${token.symbol} is now listed on the platform.`);
      reset();
    } catch (e) {
      setError(e?.message || String(e));
    }
    setBusy(false);
  };

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Upload size={16} className="text-[#00F59B]" />
        <h2 className="text-sm font-bold">Import external token</h2>
      </div>
      <p className="text-xs text-[#F2F7F4]/60">
        List an asset that already exists on Stellar, created in any wallet. Supply, holders, price and
        markets are read from the ledger; the name and artwork come from the issuer&apos;s stellar.toml
        when it publishes one.
      </p>

      {!lookup ? (
        <div className="space-y-2">
          <label className="block space-y-1">
            <FieldLabel>Asset code</FieldLabel>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="USDC"
              maxLength={12}
              className={`${INPUT_CLASS} font-mono uppercase`}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Issuer account</FieldLabel>
            <Input
              value={issuer}
              onChange={(e) => setIssuer(e.target.value.trim())}
              placeholder="G…"
              className={`${INPUT_CLASS} font-mono text-[11px]`}
            />
          </label>
          <button
            onClick={find}
            disabled={busy || !code || !issuer}
            className="w-full py-3 rounded-xl bg-[#00F59B] text-[#04100B] font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Search size={15} />
            {busy ? 'Reading the ledger…' : 'Look up on Stellar'}
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="bg-black/25 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-3">
              {lookup.image_url ? (
                <Image src={lookup.image_url} alt="" fittingType="fill" className="w-10 h-10 rounded-xl shrink-0" />
              ) : (
                <span className="w-10 h-10 rounded-xl bg-[#00F59B]/[.12] border border-[#00F59B]/30 text-[#00F59B] text-[11px] font-black flex items-center justify-center shrink-0">
                  {lookup.asset_code.slice(0, 4)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{lookup.asset_code}</p>
                <p className="text-[10px] font-mono text-[#F2F7F4]/40 truncate">{shortAddr(lookup.issuer)}</p>
              </div>
            </div>
            <Fact label="On-chain supply" value={fmt(lookup.supply)} />
            <Fact label="Holders" value={fmt(lookup.holders)} />
            <Fact label="Markets" value={poolLabel(lookup.pools)} />
            <Fact
              label="Price"
              value={lookup.price > 0 ? `${lookup.price.toFixed(8)} XLM` : 'no market yet'}
            />
            {lookup.home_domain && <Fact label="Home domain" value={lookup.home_domain} />}
          </div>

          <label className="block space-y-1">
            <FieldLabel>Name shown to members</FieldLabel>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lookup.asset_code}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block space-y-1">
            <FieldLabel>Description (optional)</FieldLabel>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What this token is"
              className={INPUT_CLASS}
            />
          </label>

          <div className="flex gap-2">
            <button
              onClick={add}
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-[#00F59B] text-[#04100B] font-bold text-sm disabled:opacity-50"
            >
              {busy ? 'Importing…' : `List $${lookup.asset_code}`}
            </button>
            <button
              onClick={reset}
              disabled={busy}
              className="px-4 py-3 rounded-xl bg-white/5 text-[#F2F7F4]/70 font-bold text-sm disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-[11px] leading-snug text-[#ff3b5c]">{error}</p>}
      {done && <p className="text-[11px] leading-snug text-[#00F59B]">{done}</p>}
    </div>
  );
}