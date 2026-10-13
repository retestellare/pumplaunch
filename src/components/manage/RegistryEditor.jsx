import { useState } from 'react';
import { Image } from '@/components/ui/image';
import { Copy, RefreshCw } from 'lucide-react';
import {
  REGISTRY_FILE,
  assetImage,
  fetchRegistryText,
  registryBlock,
  saveRegistryFields,
  servedEntry,
  withRegistryFields,
} from '@/lib/registry';

const TONE = { ok: 'text-[#00ff88]', warn: 'text-[#ffb347]', bad: 'text-[#ff3b5c]' };

const inputClass =
  'w-full bg-black/30 border border-white/5 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[#00ff88]/40';

// The registry entry this asset publishes. Editing these fields and republishing
// is what changes the name, description and artwork wallets and explorers show.
export default function RegistryEditor({ kind, record, onSaved }) {
  const stored = {
    name: record?.name || '',
    description: record?.description || '',
    image: assetImage(record, kind),
  };
  const [form, setForm] = useState(stored);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);

  const previewRecord = withRegistryFields(record, kind, form);
  const block = registryBlock(previewRecord, kind);
  const dirty =
    form.name !== stored.name ||
    form.description !== stored.description ||
    form.image !== stored.image;

  const save = async () => {
    setBusy(true);
    try {
      const saved = await saveRegistryFields(kind, record.id, form);
      onSaved?.(saved);
      setStatus({ tone: 'ok', text: 'Saved. The registry serves this text now.' });
    } catch (e) {
      setStatus({ tone: 'bad', text: e?.message || 'Could not save the changes.' });
    } finally {
      setBusy(false);
    }
  };

  // Republish saves whatever is on screen, then reads the public registry back
  // to confirm this asset's entry is the one being served.
  const republish = async () => {
    setBusy(true);
    setStatus(null);
    try {
      if (dirty) {
        const saved = await saveRegistryFields(kind, record.id, form);
        onSaved?.(saved);
      }
      const text = await fetchRegistryText();
      const entry = servedEntry(text, previewRecord, kind);
      setStatus(
        entry
          ? { tone: 'ok', text: 'Republished — the public registry is serving this entry.' }
          : { tone: 'warn', text: 'The registry does not list this asset yet.' }
      );
    } catch (e) {
      setStatus({ tone: 'bad', text: e?.message || 'Republish failed.' });
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(block || '');
      setStatus({ tone: 'ok', text: 'Entry copied.' });
    } catch {
      setStatus({ tone: 'bad', text: 'Copy failed.' });
    }
  };

  if (!block) {
    return (
      <div className="bg-[#141518] rounded-2xl p-4 space-y-1">
        <h3 className="font-bold text-sm text-white/80">stellar.toml registry</h3>
        <p className="text-xs text-white/40">
          This asset has no on-chain code yet, so the registry publishes nothing for it.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="font-bold text-sm text-white/80">stellar.toml registry</h3>
        <p className="text-[10px] text-white/30 mt-0.5">
          What wallets and explorers read for this asset — edit and republish to change it
        </p>
      </div>

      <div className="space-y-2">
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Display name"
          className={inputClass}
        />
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Description"
          rows={3}
          className={`${inputClass} resize-none`}
        />
        <div className="flex gap-2">
          <input
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
            placeholder="Artwork URL"
            className={`${inputClass} font-mono text-xs`}
          />
          {form.image && (
            <Image
              src={form.image}
              fittingType="fill"
              alt={form.name || 'Artwork'}
              className="w-11 h-11 rounded-xl border border-white/5 shrink-0"
            />
          )}
        </div>
      </div>

      <div className="bg-black/30 rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wide">
            Published entry
          </span>
          <button onClick={copy} className="flex items-center gap-1 text-[10px] text-[#00ff88]">
            <Copy size={11} /> Copy
          </button>
        </div>
        <pre className="text-[10px] leading-relaxed text-white/50 overflow-auto max-h-40 whitespace-pre-wrap break-all">
          {block}
        </pre>
      </div>

      <div className="flex gap-2">
        <button
          onClick={save}
          disabled={busy || !dirty}
          className="flex-1 py-3 rounded-xl bg-white/5 font-bold text-sm disabled:opacity-40"
        >
          Save changes
        </button>
        <button
          onClick={republish}
          disabled={busy}
          className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
        >
          <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
          Republish
        </button>
      </div>

      {status && <p className={`text-[11px] ${TONE[status.tone]}`}>{status.text}</p>}

      <p className="text-[10px] text-white/30">
        Wallets read {REGISTRY_FILE}; that published copy is rebuilt from the live registry on every
        app publish, so nothing has to be edited by hand.
      </p>
    </div>
  );
}