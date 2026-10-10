import { AlertTriangle } from 'lucide-react';

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/40">{label}</span>
      <span className={muted ? 'text-white/50' : 'font-bold'}>{value}</span>
    </div>
  );
}

function Warning({ children }) {
  return (
    <div className="flex items-start gap-2 bg-[#ff3b5c]/10 border border-[#ff3b5c]/20 rounded-xl p-3">
      <AlertTriangle size={14} className="text-[#ff3b5c] mt-0.5 shrink-0" />
      <p className="text-[10px] text-[#ff3b5c]">{children}</p>
    </div>
  );
}

export default function NftLaunchReview({
  name,
  symbol,
  supply,
  price,
  quote,
  cost,
  availableXlm,
  error,
  retrying,
  onConfirm,
  onBack,
}) {
  const needed = cost.reserveXlm + cost.feeXlm;
  const short = availableXlm != null && availableXlm < needed;

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold">Review &amp; launch on Mainnet</h3>
        <p className="text-[10px] text-white/30 mt-0.5">
          Your wallet signs three transactions on Stellar Mainnet: the issuer account, the sealed edition
          supply, and the sale itself.
        </p>
      </div>

      <div className="bg-black/30 rounded-xl p-3 space-y-2">
        <Row label="Collection" value={`${name} ($${symbol})`} />
        <Row label="Editions" value={supply.toLocaleString()} />
        <Row label="Mint price" value={`${price.toLocaleString()} ${quote.toUpperCase()}`} />
      </div>

      <div className="bg-black/30 rounded-xl p-3 space-y-2">
        <Row label="Network fee" value={`${cost.feeXlm.toFixed(7)} XLM`} muted />
        <Row label="Reserved for the collection" value={`${cost.reserveXlm} XLM`} muted />
        <Row label="XLM needed" value={`${needed.toFixed(7)} XLM`} />
        {availableXlm != null && (
          <Row label="Your available XLM" value={availableXlm.toFixed(2)} muted />
        )}
      </div>

      <p className="text-[10px] text-white/35">
        The whole edition is escrowed in one sell order on the Stellar DEX at your mint price. Anyone can
        mint, the DEX pays you directly, and the reserve returns when you cancel the sale.
      </p>

      {short && (
        <Warning>Add at least {(needed - availableXlm).toFixed(2)} XLM to this wallet first.</Warning>
      )}
      {error && <Warning>{error}</Warning>}

      <button
        onClick={onConfirm}
        disabled={short}
        className="w-full py-3.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm disabled:opacity-40"
      >
        {retrying ? 'Retry the on-chain launch' : 'Confirm & launch collection'}
      </button>
      <button onClick={onBack} className="w-full py-3 rounded-xl bg-white/5 font-bold text-sm">
        Back to the form
      </button>
    </div>
  );
}