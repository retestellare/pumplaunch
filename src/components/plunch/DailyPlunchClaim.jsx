import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';

const REWARD = 90000;
const AMOUNT_LABEL = REWARD.toLocaleString('en-US');
const EXPLORER = 'https://stellar.expert/explorer/public/tx/';

const pad = (n) => String(n).padStart(2, '0');

function countdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

const CLAIM_BUTTON =
  'w-full h-[48px] rounded-[12px] bg-[#00F59B] text-[#04100B] font-black text-[13px] tracking-[.08em] uppercase shadow-[0_0_18px_rgba(0,245,155,.5)] transition duration-200 hover:shadow-[0_0_28px_rgba(0,245,155,.7)] active:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B]';

// The daily PLUNCH drop: one request per wallet every 24 hours.
export default function DailyPlunchClaim() {
  const { wallet, connect, connecting } = useWallet();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState('idle'); // idle | claiming | sent
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');
  const [copied, setCopied] = useState(false);
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
    try {
      const { data } = await base44.functions.invoke('plunchClaim', {
        action: 'status',
        wallet_address: wallet.address,
      });
      setStatus(data);
      if (data?.eligible) {
        setPhase('idle');
        setTxHash('');
      }
    } catch (err) {
      // A failed check must not leave the card spinning forever. A blocked
      // server (402) is a service problem, not a problem with the wallet.
      setStatus(null);
      setError(
        err?.response?.status === 402
          ? 'The faucet payout is paused right now — the reward wallet is not reachable.'
          : 'Could not check this wallet right now.'
      );
    } finally {
      setLoading(false);
    }
  }, [wallet?.address]);

  useEffect(() => {
    load();
  }, [load]);

  const nextAt = status?.next_at ? new Date(status.next_at).getTime() : 0;

  // When the 24 hours run out, the card asks the server again so the button
  // unlocks on its own while the page stays open.
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
      const { data } = await base44.functions.invoke('plunchClaim', { wallet_address: wallet.address });
      setTxHash(data.tx_hash);
      setStatus((prev) =>
        prev
          ? { ...prev, eligible: false, next_at: data.next_at, balance: (prev.balance || 0) + REWARD, pool: prev.pool - REWARD }
          : prev
      );
      setPhase('sent');
    } catch (err) {
      setPhase('idle');
      setError(err?.response?.data?.error || 'The request did not go through.');
      load();
    } finally {
      inFlight.current = false;
    }
  }, [wallet?.address, load]);

  const copyAddress = useCallback(async () => {
    if (!wallet?.address) return;
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the key is on screen to select */
    }
  }, [wallet?.address]);

  const remaining = nextAt ? countdown(nextAt - now) : null;

  let actionNode;
  if (!wallet?.address) {
    actionNode = (
      <button onClick={connect} disabled={connecting} className={`${CLAIM_BUTTON} disabled:opacity-60`}>
        {connecting ? 'Connecting…' : 'Connect wallet'}
      </button>
    );
  } else if (phase === 'claiming') {
    actionNode = (
      <button
        disabled
        className="w-full h-[48px] rounded-[12px] border border-[#00F59B]/30 bg-[#16211E] text-[#00F59B] font-black text-[13px] tracking-[.08em] uppercase flex items-center justify-center gap-2"
      >
        <Loader2 size={16} className="animate-spin" /> Claiming…
      </button>
    );
  } else if (phase === 'sent') {
    actionNode = (
      <div className="rounded-[12px] border border-[#00F59B]/45 bg-[#00F59B]/[.10] p-3">
        <p className="flex items-start gap-2 text-[12.5px] font-bold text-[#F2F7F4]">
          <CheckCircle2 size={16} className="mt-[1px] shrink-0 text-[#00F59B]" />
          Successfully claimed {AMOUNT_LABEL} PLUNCH!
        </p>
        <div className="mt-2 flex items-center gap-3 pl-6">
          <a
            href={`${EXPLORER}${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#00F59B] transition duration-200 hover:text-[#7CFFD0]"
          >
            View transaction <ExternalLink size={11} />
          </a>
          {remaining && <span className="text-[11px] text-[#F2F7F4]/45">Next in {remaining}</span>}
        </div>
      </div>
    );
  } else if (loading && !status) {
    actionNode = (
      <button
        disabled
        className="w-full h-[48px] rounded-[12px] border border-[#16211E] bg-[#16211E] text-[#F2F7F4]/60 font-black text-[13px] tracking-[.08em] uppercase flex items-center justify-center gap-2"
      >
        <Loader2 size={16} className="animate-spin" /> Checking wallet…
      </button>
    );
  } else if (status?.trustline === false) {
    actionNode = (
      <p className="text-[12px] leading-snug text-[#F2F7F4]/60">
        This wallet has no PLUNCH trustline yet. Add PLUNCH in your wallet to receive the daily drop.
      </p>
    );
  } else if (status && status.pool < REWARD) {
    actionNode = (
      <p className="text-[12px] leading-snug text-[#FF4D6D]">
        The daily pool is empty right now. Try again once it is refilled.
      </p>
    );
  } else if (status?.eligible) {
    actionNode = (
      <button onClick={claim} className={CLAIM_BUTTON}>
        Claim {AMOUNT_LABEL} PLUNCH
      </button>
    );
  } else if (status) {
    actionNode = (
      <button
        disabled
        className="w-full h-[48px] rounded-[12px] border border-[#16211E] bg-[#16211E] text-[#F2F7F4]/45 font-black text-[12px] tracking-[.08em] uppercase"
      >
        Next claim in {remaining || '00:00:00'}
      </button>
    );
  } else {
    // Status could not be read: the button still stands so the drop is one tap
    // away, and whatever went wrong is reported underneath it.
    actionNode = (
      <button onClick={claim} className={CLAIM_BUTTON}>
        Claim {AMOUNT_LABEL} PLUNCH
      </button>
    );
  }

  return (
    <div className="rounded-[16px] border border-[#16211E] bg-[#101816] p-4">
      <p className="font-display text-[15px] tracking-[.04em] text-[#F2F7F4]">Claim Tokens</p>

      <p className="mt-3 text-[9px] font-black uppercase tracking-[.14em] text-[#F2F7F4]/40">
        Your Stellar public key
      </p>
      <div className="mt-1.5 flex items-center gap-2 h-[46px] rounded-[12px] border border-[#1E2A26] bg-[#0C1512] px-3">
        <span className={`flex-1 min-w-0 truncate font-mono text-[11px] ${wallet?.address ? 'text-[#F2F7F4]/80' : 'text-[#F2F7F4]/35'}`}>
          {wallet?.address || 'Connect a wallet to continue'}
        </span>
        {wallet?.address && (
          <button
            onClick={copyAddress}
            aria-label="Copy public key"
            className="text-[#F2F7F4]/45 transition duration-200 hover:text-[#00F59B]"
          >
            {copied ? <Check size={15} className="text-[#00F59B]" /> : <Copy size={15} />}
          </button>
        )}
      </div>

      <div className="mt-3">{actionNode}</div>
      {error && <p className="mt-2 text-[11px] leading-snug text-[#FF4D6D]">{error}</p>}
    </div>
  );
}