import { useState } from 'react';
import { Check, Copy, Share2 } from 'lucide-react';
import { referralLink } from '@/lib/referrals';
import { sharePayload } from '@/lib/share';

// The invite itself: the link, a copy action and the share sheet.
export default function InviteLinkCard({ wallet, invited = 0 }) {
  const [copied, setCopied] = useState(false);
  const link = referralLink(wallet);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the link stays on screen to copy by hand */
    }
  };

  const share = () =>
    sharePayload({
      title: 'Join Stellar Pump',
      text: '🚀 Join me on Stellar Pump — launch and trade memecoins on Stellar. We both get PLUNCH when you set up your profile.',
      url: link,
    });

  return (
    <section className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold">Your invite link</h3>
        <p className="text-[10px] text-[#F2F7F4]/40 mt-0.5">
          {invited === 1 ? '1 member joined' : `${invited} members joined`} with your link.
        </p>
      </div>

      <div className="flex items-center gap-2 bg-black/30 border border-white/5 rounded-xl p-2.5">
        <span className="flex-1 min-w-0 text-[10px] font-mono text-[#00F59B] truncate">{link}</span>
        <button
          onClick={copy}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#00F59B] text-[#04100B] text-[11px] font-bold"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <button
        onClick={share}
        className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-[#00F59B]/30 bg-[#00F59B]/[.07] text-[11px] font-black uppercase tracking-[.08em] text-[#00F59B]"
      >
        <Share2 size={14} /> Share invite
      </button>

      <p className="text-[10px] leading-relaxed text-[#F2F7F4]/35">
        The reward lands automatically on both wallets as soon as your friend sets up a profile
        with a name and photo.
      </p>
    </section>
  );
}