import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import { X } from 'lucide-react';

export default function CreatePost({ onDone }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [position, setPosition] = useState('');
  const [pnl, setPnl] = useState('');

  const submit = async () => {
    if (!content.trim()) return;
    await base44.entities.Post.create({
      content,
      author: wallet?.address
        ? `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}`
        : 'Anonymous',
      token_symbol: tokenSymbol,
      position_size: parseFloat(position) || 0,
      pnl: parseFloat(pnl) || 0,
      likes: 0,
      comments_count: 0,
    });
    toast({ title: 'Callout posted!' });
    onDone();
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-lg">New Callout</h2>
        <button onClick={onDone}>
          <X size={20} className="text-white/40" />
        </button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share your trade thesis…"
        rows={4}
        className="w-full bg-[#141518] border border-white/5 rounded-xl p-3 text-sm outline-none focus:border-[#00ff88]/40 resize-none"
      />
      <input
        value={tokenSymbol}
        onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
        placeholder="Token (e.g. MOON)"
        className="w-full bg-[#141518] border border-white/5 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#00ff88]/40"
      />
      <input
        value={position}
        onChange={(e) => setPosition(e.target.value)}
        type="number"
        placeholder="Position size (XLM)"
        className="w-full bg-[#141518] border border-white/5 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#00ff88]/40"
      />
      <input
        value={pnl}
        onChange={(e) => setPnl(e.target.value)}
        type="number"
        placeholder="PnL (XLM, use - for loss)"
        className="w-full bg-[#141518] border border-white/5 rounded-xl px-3 py-3 text-sm outline-none focus:border-[#00ff88]/40"
      />
      <button
        onClick={submit}
        className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm"
      >
        Post Callout
      </button>
    </div>
  );
}