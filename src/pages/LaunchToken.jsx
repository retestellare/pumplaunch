import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import PageLayout from '@/components/PageLayout';

export default function LaunchToken() {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', symbol: '', description: '' });
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.name || !form.symbol) {
      toast({ title: 'Name and symbol required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const price = 0.000001;
    const supply = 1000000000;
    const t = await base44.entities.Token.create({
      name: form.name,
      symbol: form.symbol.toUpperCase(),
      description: form.description,
      creator: wallet?.address || 'Anonymous',
      price,
      supply,
      market_cap: price * supply,
      holders: 1,
      volume_24h: 0,
      change_24h: 0,
      is_graduated: false,
    });
    setLoading(false);
    toast({ title: `$${form.symbol.toUpperCase()} launched!` });
    navigate(`/token/${t.id}`);
  };

  return (
    <PageLayout title="Launch Token">
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
            <label className="text-xs text-white/40 mb-1.5 block">Symbol</label>
            <input
              value={form.symbol}
              onChange={(e) =>
                setForm({ ...form, symbol: e.target.value.toUpperCase().slice(0, 10) })
              }
              placeholder="e.g. DOGERKT"
              className="w-full bg-black/30 border border-white/5 rounded-xl px-3 py-3 outline-none focus:border-[#00ff88]/40"
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
        </div>
        <button
          onClick={submit}
          disabled={loading}
          className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
        >
          {loading ? 'Launching…' : 'Launch Token'}
        </button>
        <p className="text-xs text-white/30 text-center">
          Supply: 1B · Starts at $0.000001 · Graduates at $69K market cap
        </p>
      </div>
    </PageLayout>
  );
}