// Everything about the payment before it is signed: where it goes, what it says,
// and what it costs.
export default function ChallengeReview({ tokenSymbol, amountXlm, destination, memo }) {
  const rows = [
    { label: 'Nominated token', value: `$${tokenSymbol || ''}` },
    { label: 'Stake', value: `${amountXlm} XLM` },
    { label: 'Destination', value: destination },
    { label: 'Memo', value: memo, mono: true },
    { label: 'Network fee', value: '≈ 0.00001 XLM' },
  ];

  return (
    <div className="space-y-2 rounded-[12px] border border-[#16211E] bg-[#0f1815] p-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start justify-between gap-3">
          <span className="shrink-0 pt-0.5 text-[10px] uppercase tracking-[.08em] text-[#F2F7F4]/40">
            {row.label}
          </span>
          <span
            className={`break-all text-right text-[12px] font-bold ${
              row.mono ? 'font-mono text-[#00F59B]' : ''
            }`}
          >
            {row.value || '—'}
          </span>
        </div>
      ))}
      <p className="border-t border-[#16211E] pt-2 text-[10px] leading-relaxed text-[#F2F7F4]/45">
        This is a real Stellar mainnet payment. The memo must stay attached: the throne is
        awarded from the verified on-chain stake, and a stake below the standing bid does not
        unseat the King.
      </p>
    </div>
  );
}