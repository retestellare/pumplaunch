import { Crown, Info, Clock, Check } from 'lucide-react';

const VIEWS = {
  won: {
    icon: Crown,
    tone: 'text-[#FFD166]',
    title: 'The throne is taken',
    note: (r) => `$${r?.king?.token_symbol || ''} now holds the throne with a ${Number(r?.king?.bid_xlm) || 0} XLM stake.`,
  },
  outbid: {
    icon: Info,
    tone: 'text-[#F2F7F4]/70',
    title: 'Stake verified, King held',
    note: () =>
      'Your payment cleared, but the standing bid was already higher — the King keeps the throne.',
  },
  pending: {
    icon: Clock,
    tone: 'text-[#00F59B]',
    title: 'Stake submitted',
    note: () =>
      'The payment is still settling on Stellar. Refresh Home in a moment to see the result.',
  },
  invalid: {
    icon: Info,
    tone: 'text-[#ff4d6d]',
    title: 'Stake not accepted',
    note: (r) => r?.error || 'The payment did not match this challenge.',
  },
  confirmed: {
    icon: Check,
    tone: 'text-[#00F59B]',
    title: 'Stake confirmed',
    note: () => 'The verified stake is recorded on the challenge history.',
  },
};

export default function ChallengeOutcome({ result, onClose }) {
  const view = VIEWS[result?.status] || VIEWS.confirmed;
  const Icon = view.icon;

  return (
    <div className="space-y-3 text-center">
      <Icon className={`mx-auto ${view.tone}`} size={30} />
      <div>
        <h3 className={`font-display text-[15px] uppercase tracking-[.04em] ${view.tone}`}>
          {view.title}
        </h3>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#F2F7F4]/55">{view.note(result)}</p>
      </div>
      {result?.hash && (
        <a
          href={`https://stellar.expert/explorer/public/tx/${result.hash}`}
          target="_blank"
          rel="noreferrer"
          className="block break-all font-mono text-[10px] text-[#00F59B]/70 underline"
        >
          {result.hash}
        </a>
      )}
      <button
        onClick={onClose}
        className="h-[42px] w-full rounded-[10px] bg-[#16211E] font-black text-[11px] uppercase tracking-[.08em] text-[#F2F7F4] transition duration-200 hover:shadow-[0_0_12px_rgba(0,245,155,.35)]"
      >
        Close
      </button>
    </div>
  );
}