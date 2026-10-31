import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, ExternalLink, Loader2, Rocket } from 'lucide-react';
import { useWallet } from '@/lib/wallet';

const REWARD = 90000;
const AMOUNT_LABEL = REWARD.toLocaleString('en-US');
const EXPLORER = 'https://stellar.expert/explorer/public/tx/';

const pad = (n) => String(n).padStart(2, '0');

function countdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

// The app's funded wallet sends the PLUNCH; the claim record it writes is what
// keeps the 24-hour rule per wallet.
async function invoke(payload) {
  try {
    const res = await base44.functions.invoke('plunchClaim', payload);
    return { data: res?.data ?? res, error: null };
  } catch (err) {
    const data = err?.response?.data;
    return { data, error: data?.error || err?.message || 'The faucet did not answer.' };
  }
}

export default function DailyPlunchClaim() {
  const { wallet, connect, connecting } = useWallet();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | claiming | sent
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const refreshedFor = useRef(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    if (!wallet?.address) {
      setStatus(null);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: failure } = await invoke({
      action: 'status',
      wallet_address: wallet.address,
    });
    setStatus(data && !failure ? data : null);
    if (failure) setError(failure);
    setLoading(false);
  }, [wallet?.address]);

  useEffect(() => {
    load();
  }, [load]);

  const nextAt = status?.next_at ? new Date(status.next_at).getTime() : 0;

  // When the 24 hours run out, the card asks again so the button unlocks on its
  // own while the page stays open.
  useEffect(() => {
    if (!nextAt || now < nextAt || refreshedFor.current === nextAt) return;
    refreshedFor.current = nextAt;
    load();
  }, [now, nextAt, load]);

  const claim = useCallback(async () => {
    if (!wallet?.address || inFlight.current) return;
    inFlight.current = true;
    setPhase('claiming');
    setError('');
    const { data, error: failure } = await invoke({
      action: 'claim',
      wallet_address: wallet.address,
    });
    if (failure) {
      setPhase('idle');
      setError(failure);
      load();
    } else {
      setTxHash(data?.tx_hash || '');
      const unlockedAt = data?.next_at ? new Date(data.next_at).toISOString() : null;
      setStatus((prev) =>
        prev ? { ...prev, eligible: false, next_at: unlockedAt } : prev
      );
      setPhase('sent');
    }
    inFlight.current = false;
  }, [wallet?.address, load]);

  const remaining = nextAt ? countdown(nextAt - now) : null;

  let bodyNode;
  if (!wallet?.address) {
    bodyNode = (
      <>
        <p className="text-[12px] leading-snug text-[#F2F7F4]/60">
          Connect a wallet holding PLUNCH to collect today&apos;s drop.
        </p>
        <button
          onClick={connect}
          disabled={connecting}
          className="mt-2.5 w-full h-[44px] rounded-[12px] bg-[#00F59B] text-[#04100B] font-black text-[12px] tracking-[.08em] uppercase shadow-[0_0_18px_rgba(0,245,155,.45)] transition duration-200 hover:shadow-[0_0_26px_rgba(0,245,155,.65)] active:opacity-85 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
        >
          {connecting ? 'Connecting…' : 'Connect wallet'}
        </button>
      </>
    );
  } else if (loading && !status) {
    bodyNode = (
      <p className="flex items-center gap-2 text-[12px] text-[#F2F7F4]/45">
        <Loader2 size={14} className="animate-spin" /> Checking your wallet…
      </p>
    );
  } else if (phase === 'sent') {
    bodyNode = (
      <>
        <p className="flex items-start gap-2 text-[12px] font-bold text-[#00F59B]">
          <Check size={15} className="mt-[1px] shrink-0" />
          Sent — {AMOUNT_LABEL} PLUNCH landed in your wallet.
        </p>
        {txHash && (
          <a
            href={`${EXPLORER}${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#F2F7F4]/50 transition duration-200 hover:text-[#00F59B]"
          >
            View transaction <ExternalLink size={12} />
          </a>
        )}
        {remaining && (
          <p className="mt-2 text-[11px] text-[#F2F7F4]/45">
            Next drop in <span className="font-mono text-[#F2F7F4]/70">{remaining}</span>
          </p>
        )}
      </>
    );
  } else if (status?.trustline === false) {
    bodyNode = (
      <p className="text-[12px] leading-snug text-[#F2F7F4]/60">
        This wallet has no PLUNCH trustline yet. Add PLUNCH in your wallet to receive the daily drop.
      </p>
    );
  } else if (status?.eligible) {
    bodyNode = (
      <>
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#00F59B]">Today&apos;s drop is ready</p>
        <button
          onClick={claim}
          className="mt-2 w-full h-[46px] rounded-[12px] bg-[#00F59B] text-[#04100B] font-black text-[13px] tracking-[.08em] uppercase shadow-[0_0_18px_rgba(0,245,155,.5)] transition duration-200 hover:shadow-[0_0_28px_rgba(0,245,155,.7)] active:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
        >
          Request {AMOUNT_LABEL} PLUNCH
        </button>
      </>
    );
  } else if (status) {
    bodyNode = (
      <>
        <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#F2F7F4]/40">Next drop in</p>
        <p className="font-mono text-[22px] leading-tight tracking-[.06em] text-[#F2F7F4]">
          {remaining || '00:00:00'}
        </p>
      </>
    );
  } else {
    bodyNode = (
      <button
        onClick={load}
        className="w-full h-[46px] rounded-[12px] bg-[#16211E] border border-[#00F59B]/30 text-[#00F59B] font-black text-[12px] tracking-[.08em] uppercase transition duration-200 hover:shadow-[0_0_16px_rgba(0,245,155,.45)] active:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]"
      >
        Check my eligibility
      </button>
    );
  }

  return (
    <div className="rounded-[16px] border border-[#00F59B]/25 bg-[linear-gradient(135deg,#101a17,#101816)] p-3.5 shadow-[0_0_24px_rgba(0,245,155,.09)]">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-[12px] bg-[#00F59B]/[.12] border border-[#00F59B]/30 text-[#00F59B] flex items-center justify-center shrink-0">
          <Rocket size={19} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[.14em] text-[#F2F7F4]/45">Daily PLUNCH drop</p>
          <p className="font-display text-[19px] leading-tight text-[#00F59B] [text-shadow:0_0_14px_rgba(0,245,155,.45)]">
            {AMOUNT_LABEL} PLUNCH
          </p>
        </div>
      </div>
      <div className="mt-3">
        {phase === 'claiming' ? (
          <button
            disabled
            className="w-full h-[46px] rounded-[12px] bg-[#16211E] border border-[#00F59B]/30 text-[#00F59B] font-black text-[13px] tracking-[.08em] uppercase flex items-center justify-center gap-2"
          >
            <Loader2 size={16} className="animate-spin" /> Sending…
          </button>
        ) : (
          bodyNode
        )}
      </div>
      {error && <p className="mt-2 text-[11px] leading-snug text-[#FF4D6D]">{error}</p>}
    </div>
  );
}