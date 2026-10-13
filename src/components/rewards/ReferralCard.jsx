import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { referralCountLabel, referralLink } from '@/lib/referrals';
import { referralCardAssets } from '@/lib/shareCard';
import ShareCardBlock from './ShareCardBlock';

function fmtXlm(value) {
  return (parseFloat(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// A member's own invite: the link, a copy action and the card it shares.
export default function ReferralCard({ wallet, count, rewardXlm }) {
  const [copied, setCopied] = useState(false);
  const link = referralLink(wallet);
  const payload = {
    title: `Earn ${fmtXlm(rewardXlm)} XLM on Stellar Pump`,
    text: '🚀 Join me on Stellar Pump — launch and trade memecoins on the Stellar DEX.',
    url: link,
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the link stays on screen to copy by hand */
    }
  };

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold">Your referral link</h3>
        <p className="text-[10px] text-[#F2F7F4]/40 mt-0.5">
          {referralCountLabel(count || 0)} so far — a new member who connects through this link is
          credited to you.
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

      <ShareCardBlock
        key={link}
        build={() => referralCardAssets({ rewardXlm, wallet })}
        payload={payload}
        filename="stellar-pump-referral.png"
        note="The card carries your link — anyone opening it lands on the rewards page."
      />
    </div>
  );
}