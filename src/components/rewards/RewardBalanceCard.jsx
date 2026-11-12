import { Check, ExternalLink, Loader2 } from 'lucide-react';
import PayoutShareButton from '@/components/rewards/PayoutShareButton';

const EXPLORER = 'https://stellar.expert/explorer/public/tx/';
const fmt = (n) => (Number(n) > 0 ? Math.round(Number(n)).toLocaleString('en-US') : '0');

// What the wallet has earned and not yet taken: one request sends all of it.
export default function RewardBalanceCard({ plunch = 0, price = 0, phase, payout, onRequest, error }) {
  const sending = phase === 'sending';
  const paid = phase === 'paid' && payout;
  const amount = paid ? payout.amount : plunch;
  const xlm = price > 0 ? (Number(amount) * price).toFixed(2) : null;

  return (
    <section className="rounded-[18px] border border-[#00F59B]/25 bg-[linear-gradient(135deg,#101a17,#0d1412)] p-4 shadow-[0_0_26px_rgba(0,245,155,.10)]">
      <p className="text-[9px] font-black uppercase tracking-[.16em] text-[#F2F7F4]/45">
        {paid ? 'Received' : 'Accumulated rewards'}
      </p>
      <p className="mt-1.5 font-display text-[30px] leading-none text-[#00F59B] [text-shadow:0_0_18px_rgba(0,245,155,.45)]">
        {fmt(amount)}
        <span className="ml-1.5 text-[12px] text-[#00F59B]/70">PLUNCH</span>
      </p>
      <p className="mt-1.5 text-[10px] leading-relaxed text-[#F2F7F4]/40">
        {xlm ? `≈ ${xlm} XLM at the live rate` : 'Reading the live PLUNCH rate…'}
        {' · '}each completed invite pays 1 XLM of PLUNCH to both wallets.
      </p>

      {paid ? (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-[#00F59B]">
            <Check size={13} /> Sent to your wallet.
          </p>
          <div className="flex gap-2">
            <PayoutShareButton amount={payout.amount} className="flex-1" />
            {payout.hash && (
              <a
                href={`${EXPLORER}${payout.hash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-xl border border-white/10 bg-white/[.04] text-[10px] font-black uppercase tracking-[.1em] text-[#F2F7F4]/60"
              >
                Tx <ExternalLink size={11} />
              </a>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={onRequest}
          disabled={sending || plunch < 1}
          className="mt-3 flex w-full items-center justify-center gap-2 h-11 rounded-xl bg-[#00F59B] text-[#04100B] font-display text-[12px] uppercase tracking-[.05em] shadow-[0_0_18px_rgba(0,245,155,.35)] transition duration-200 active:opacity-85 disabled:opacity-40 disabled:shadow-none"
        >
          {sending ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Sending…
            </>
          ) : plunch >= 1 ? (
            `Request ${fmt(plunch)} PLUNCH`
          ) : (
            'Nothing to request yet'
          )}
        </button>
      )}

      {error && <p className="mt-2 text-[10px] leading-snug text-[#FF4D6D]">{error}</p>}
    </section>
  );
}