import { useState } from 'react';
import { Loader2 } from 'lucide-react';

// A team is just a name, a line about what it does, and the wallets in it.
export default function CreateTeamForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give your team a name.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onCreate({ name, description });
      setName('');
      setDescription('');
    } catch (err) {
      setError(err?.message || 'The team could not be created.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-2xl border border-[#00ff88]/20 bg-[#141518] p-4">
      <p className="text-sm font-bold text-white">Create a team</p>
      <p className="mt-0.5 text-[11px] text-white/40">
        Invite the people you launch and trade with, and keep them in one place.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Team name"
        maxLength={40}
        className="mt-3 h-10 w-full rounded-xl bg-[#0a0b0d] px-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#00ff88]/40"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What does your team do? (optional)"
        maxLength={240}
        rows={2}
        className="mt-2 w-full resize-none rounded-xl bg-[#0a0b0d] px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#00ff88]/40"
      />
      {error && <p className="mt-2 text-[11px] text-[#ff3b5c]">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#00ff88] px-4 text-xs font-bold text-black disabled:opacity-60"
        >
          {busy && <Loader2 size={13} className="animate-spin" />} Create team
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-9 rounded-xl border border-white/10 px-4 text-xs font-bold text-white/50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}