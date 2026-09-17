import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import { X, ImagePlus } from 'lucide-react';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export default function CreatePost({ onDone }) {
  const { wallet } = useWallet();
  const { toast } = useToast();
  const [content, setContent] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [position, setPosition] = useState('');
  const [pnl, setPnl] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [posting, setPosting] = useState(false);

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: 'Image must be 5MB or smaller', variant: 'destructive' });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      let imageUrl = null;
      if (imageFile) {
        const { file_url } = await base44.integrations.Core.UploadPublicFile({ file: imageFile });
        imageUrl = file_url;
      }
      await base44.entities.Post.create({
        content,
        author: wallet?.address
          ? `${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}`
          : 'Anonymous',
        image_url: imageUrl,
        token_symbol: tokenSymbol,
        position_size: parseFloat(position) || 0,
        pnl: parseFloat(pnl) || 0,
        likes: 0,
        comments_count: 0,
      });
      toast({ title: 'Callout posted!' });
      onDone();
    } catch (e) {
      toast({ title: 'Failed to post', description: e.message || String(e), variant: 'destructive' });
    }
    setPosting(false);
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
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="w-16 h-16 rounded-xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-[#141518] border border-white/5 flex items-center justify-center">
              <ImagePlus size={20} className="text-white/30" />
            </div>
          )}
          <span className="text-sm text-white/50">
            {imageFile ? 'Change image' : 'Attach image (optional)'}
          </span>
        </label>
      </div>
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
        disabled={posting || !content.trim()}
        className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-50"
      >
        {posting ? 'Posting…' : 'Post Callout'}
      </button>
    </div>
  );
}