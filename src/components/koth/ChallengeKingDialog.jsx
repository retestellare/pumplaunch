import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWallet } from '@/lib/wallet';
import { useToast } from '@/components/ui/use-toast';
import KingTokenPicker from './KingTokenPicker';
import ChallengeReview from './ChallengeReview';
import ChallengeOutcome from './ChallengeOutcome';
import { createChallenge, fetchKothConfig, submitStake } from '@/lib/koth';

// Pick a token, stake XLM, review the exact payment, then let the chain decide.
export default function ChallengeKingDialog({ open, onOpenChange, tokens, king, onSettled }) {
  const { wallet, connect, connecting } = useWallet();
  const { toast } = useToast();
  const [step, setStep] = useState('form');
  const [tokenId, setTokenId] = useState('');
  const [amount, setAmount] = useState('');
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState(null);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const standing = Number(king?.bid_xlm) || 0;
  const picked = tokens.find((t) => t.id === tokenId) || null;
  const value = parseFloat(amount) || 0;
  const minOpening = Number(config?.min_opening_xlm ?? 1);
  const ready = !!picked && !!wallet?.address && value > standing && value >= minOpening;

  // Opening the dialog also refreshes the platform wallet and the current floor.
  useEffect(() => {
    if (!open) return;
    setStep('form');
    setDraft(null);
    setResult(null);
    setError(null);
    setStatus('');
    let live = true;
    fetchKothConfig()
      .then((c) => {
        if (live) setConfig(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);

  const openReview = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      setDraft(
        await createChallenge({ walletAddress: wallet.address, tokenId: picked.id, amountXlm: value })
      );
      setStep('review');
    } catch (e) {
      setError(e.message || String(e));
    }
    setBusy(false);
  };

  const send = async () => {
    setStep('sending');
    setError(null);
    setStatus('Confirm the stake in your wallet…');
    try {
      const outcome = await submitStake({
        challenge: draft,
        walletAddress: wallet.address,
        amountXlm: value,
        onStep: (s) =>
          setStatus(
            s === 'verifying'
              ? 'Verifying the stake on Stellar…'
              : 'Confirm the stake in your wallet…'
          ),
      });
      setResult(outcome);
      setStep('done');
      if (outcome.status === 'won') {
        toast({ title: `👑 $${outcome.king?.token_symbol || picked?.symbol || ''} takes the throne` });
      }
      onSettled?.();
    } catch (e) {
      setError(e.message || String(e));
      setStep('review');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px] rounded-[14px] border border-[#FFD166]/25 bg-[#0c1210] text-[#F2F7F4]">
        <DialogHeader>
          <DialogTitle className="font-display text-[15px] uppercase tracking-[.04em] text-[#FFD166]">
            👑 Challenge the King
          </DialogTitle>
          <DialogDescription className="text-[11px] leading-relaxed text-[#F2F7F4]/45">
            {standing > 0
              ? `The throne stands at ${standing} XLM. Stake more on a token you back to unseat the King.`
              : 'No King yet. The first verified stake takes the throne.'}
          </DialogDescription>
        </DialogHeader>

        {!wallet ? (
          <button
            onClick={connect}
            disabled={connecting}
            className="h-[42px] w-full rounded-[10px] bg-[#FFD166] font-black text-[11px] uppercase tracking-[.08em] text-[#241a02] disabled:opacity-50"
          >
            {connecting ? 'Connecting…' : 'Connect wallet to challenge'}
          </button>
        ) : step === 'form' ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[.08em] text-[#F2F7F4]/40">
                Nominate a token
              </label>
              <KingTokenPicker
                tokens={tokens}
                value={tokenId}
                onChange={setTokenId}
                kingTokenId={king?.token_id}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[.08em] text-[#F2F7F4]/40">
                Your stake (XLM)
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                inputMode="decimal"
                placeholder={standing > 0 ? `More than ${standing}` : `At least ${minOpening}`}
                className="h-[42px] w-full rounded-[10px] border border-[#16211E] bg-[#0f1815] px-3 text-[14px] font-bold tabular-nums outline-none focus:border-[#FFD166]/50"
              />
              <p className="mt-1.5 text-[10px] text-[#F2F7F4]/40">
                {standing > 0
                  ? `Must beat the standing ${standing} XLM stake.`
                  : `Minimum ${minOpening} XLM.`}
              </p>
            </div>
            {error && <p className="text-[11px] text-[#ff4d6d]">{error}</p>}
            <button
              onClick={openReview}
              disabled={!ready || busy}
              className="h-[42px] w-full rounded-[10px] bg-[#FFD166] font-black text-[11px] uppercase tracking-[.08em] text-[#241a02] transition duration-200 hover:shadow-[0_0_16px_rgba(255,209,102,.5)] disabled:opacity-40"
            >
              {busy ? 'Preparing…' : 'Review stake'}
            </button>
          </div>
        ) : step === 'review' ? (
          <div className="space-y-3">
            <ChallengeReview
              tokenSymbol={picked?.symbol}
              amountXlm={value}
              destination={draft?.destination}
              memo={draft?.memo}
            />
            {error && <p className="text-[11px] text-[#ff4d6d]">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setStep('form')}
                className="h-[42px] flex-1 rounded-[10px] border border-[#16211E] font-black text-[11px] uppercase tracking-[.08em] text-[#F2F7F4]/70"
              >
                Back
              </button>
              <button
                onClick={send}
                className="h-[42px] flex-[2] rounded-[10px] bg-[#FFD166] font-black text-[11px] uppercase tracking-[.08em] text-[#241a02] transition duration-200 hover:shadow-[0_0_16px_rgba(255,209,102,.5)]"
              >
                Sign &amp; send {value} XLM
              </button>
            </div>
          </div>
        ) : step === 'sending' ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-[22px] w-[22px] animate-spin rounded-full border-2 border-[#16211E] border-t-[#FFD166]" />
            <p className="text-[11px] text-[#F2F7F4]/55">{status}</p>
          </div>
        ) : (
          <ChallengeOutcome result={result} onClose={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}