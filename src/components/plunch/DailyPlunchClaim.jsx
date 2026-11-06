import { useCallback, useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Check, ExternalLink, Loader2 } from 'lucide-react';
import { useWallet } from '@/lib/wallet';
import { claimDropWithTrustline } from '@/lib/plunch';
import ShareReceiptButton from '@/components/plunch/ShareReceiptButton';

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
    try {
      const { data, error: failure } = await invoke({
        action: 'claim',
        wallet_address: wallet.address,
      });
      if (failure) throw new Error(failure);

      let hash = data?.tx_hash || '';
      let unlockedAt = data?.next_at ? new Date(data.next_at).toISOString() : null;

      // No PLUNCH line yet: the drop is parked and the wallet signs ONE transaction
      // that opens the trustline and claims it into the same wallet.
      if (data?.claimable_balance_id) {
        const result = await claimDropWithTrustline({
          walletAddress: wallet.address,
          balanceId: data.claimable_balance_id,
        });
        hash = result?.hash || hash;
        const { data: confirmed, error: confirmFailure } = await invoke({
          action: 'confirm',
          wallet_address: wallet.address,
          tx_hash: hash,
        });
        if (confirmFailure) throw new Error(confirmFailure);
        if (confirmed?.next_at) unlockedAt = new Date(confirmed.next_at).toISOString();
      }

      setTxHash(hash);
      setStatus((prev) =>
        prev ? { ...prev, eligible: false, trustline: true, next_at: unlockedAt } : prev
      );
      setPhase('sent');
    } catch (err) {
      setPhase('idle');
      setError(err?.message || 'The claim did not go through.');
    } finally {
      inFlight.current = false;
    }
  }, [wallet?.address]);

  // A lock that has already run out is not a countdown: it means the status on
  // screen is stale, so the card asks again instead of sitting on 00:00:00.
  const remaining = nextAt > now ? countdown(nextAt - now) : null;
  const poolShort = status?.pool != null && status.pool < REWARD;

  // Two compact slots: the action sits beside the amount, the note runs under it.
  const pill =
    'h-[30px] px-3 rounded-[9px] font-black text-[10px] tracking-[.07em] uppercase transition duration-200 active:opacity-85 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]';
  const primary = `${pill} bg-[#00F59B] text-[#04100B] shadow-[0_0_14px_rgba(0,245,155,.5)] hover:shadow-[0_0_20px_rgba(0,245,155,.7)]`;
  const ghost = `${pill} bg-[#16211E] border border-[#00F59B]/30 text-[#00F59B] hover:shadow-[0_0_14px_rgba(0,245,155,.45)]`;

  let actionNode = null;
  let noteNode = null;

  if (!wallet?.address) {
    actionNode = (
      <button onClick={connect} disabled={connecting} className={primary}>
        {connecting ? 'Connecting…' : 'Connect'}
      </button>
    );
    noteNode = <>Connect a wallet holding PLUNCH to collect today&apos;s drop.</>;
  } else if (loading && !status) {
    noteNode = (
      <span className="flex items-center gap-1.5">
        <Loader2 size={11} className="animate-spin" /> Checking your wallet…
      </span>
    );
  } else if (phase === 'sent') {
    actionNode = <ShareReceiptButton amount={REWARD} />;
    noteNode = (
      <>
        <span className="flex items-center gap-1 font-bold text-[#00F59B]">
          <Check size={11} className="shrink-0" /> Sent — {AMOUNT_LABEL} PLUNCH landed.
        </span>
        <span className="mt-0.5 flex items-center gap-2.5">
          {txHash && (
            <a
              href={`${EXPLORER}${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-bold text-[#F2F7F4]/50 transition duration-200 hover:text-[#00F59B]"
            >
              View tx <ExternalLink size={10} />
            </a>
          )}
          {remaining && (
            <span>
              Next in <span className="font-mono text-[#F2F7F4]/70">{remaining}</span>
            </span>
          )}
        </span>
      </>
    );
  } else if (status?.trustline === false) {
    if (poolShort) {
      actionNode = (
        <button onClick={load} className={ghost}>
          Check again
        </button>
      );
      noteNode = <>The daily PLUNCH pool is refilling — no drop available right now.</>;
    } else {
      actionNode = (
        <button onClick={claim} className={primary}>
          Request {AMOUNT_LABEL}
        </button>
      );
      noteNode = <>One approval opens your PLUNCH trustline and receives the drop in the same transaction.</>;
    }
  } else if (status?.eligible) {
    actionNode = (
      <button onClick={claim} className={primary}>
        Request {AMOUNT_LABEL}
      </button>
    );
    noteNode = <>Today&apos;s drop is ready — one tap sends it to your wallet.</>;
  } else if (status) {
    if (remaining) {
      actionNode = <ShareReceiptButton amount={REWARD} />;
      noteNode = (
        <>
          Next drop in <span className="font-mono text-[11px] text-[#F2F7F4]/80">{remaining}</span>
        </>
      );
    } else {
      actionNode = (
        <button onClick={load} className={ghost}>
          Check again
        </button>
      );
      noteNode = (
        <>
          {poolShort
            ? 'The daily PLUNCH pool is refilling — no drop available right now.'
            : 'No drop is open for this wallet right now.'}
        </>
      );
    }
  } else {
    actionNode = (
      <button onClick={load} className={ghost}>
        Check eligibility
      </button>
    );
  }

  return (
    <div className="rounded-[14px] border border-[#00F59B]/25 bg-[linear-gradient(135deg,#101a17,#101816)] px-3 py-2.5 shadow-[0_0_24px_rgba(0,245,155,.09)]">
      <div className="flex items-center gap-2.5">
        <span className="h-8 px-2 rounded-[10px] bg-[#00F59B]/[.12] border border-[#00F59B]/30 text-[#00F59B] flex items-center justify-center shrink-0 font-display text-[8px] leading-none tracking-[.06em] [text-shadow:0_0_10px_rgba(0,245,155,.45)]">
          PLUNCH
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[.12em] text-[#F2F7F4]/45">Daily PLUNCH drop</p>
          <p className="font-display text-[15px] leading-tight text-[#00F59B] [text-shadow:0_0_14px_rgba(0,245,155,.45)]">
            {AMOUNT_LABEL} PLUNCH
          </p>
        </div>
        <div className="shrink-0">
          {phase === 'claiming' ? (
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[.07em] text-[#00F59B]">
              <Loader2 size={12} className="animate-spin" /> Sending…
            </span>
          ) : (
            actionNode
          )}
        </div>
      </div>
      {noteNode && (
        <div className="mt-1.5 text-[10px] leading-snug text-[#F2F7F4]/50">{noteNode}</div>
      )}
      {error && <p className="mt-1 text-[10px] leading-snug text-[#FF4D6D]">{error}</p>}
    </div>
  );
}