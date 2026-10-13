const STATUS = {
  pending: { label: 'Pending review', className: 'text-[#ffb020] border-[#ffb020]/40 bg-[#ffb020]/10' },
  approved: { label: 'Approved', className: 'text-[#4d9eff] border-[#4d9eff]/40 bg-[#4d9eff]/10' },
  paid: { label: 'Paid', className: 'text-[#00F59B] border-[#00F59B]/40 bg-[#00F59B]/10' },
  rejected: { label: 'Rejected', className: 'text-[#ff3b5c] border-[#ff3b5c]/40 bg-[#ff3b5c]/10' },
};

export function ClaimStatusChip({ status }) {
  const chip = STATUS[status] || STATUS.pending;
  return (
    <span
      className={`text-[10px] font-black tracking-[.06em] uppercase px-2 py-1 rounded-full border ${chip.className}`}
    >
      {chip.label}
    </span>
  );
}

function fmtXlm(value) {
  return (parseFloat(value) || 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

// Every claim this wallet has made, with what the reviewer said about it.
export default function ClaimHistory({ claims }) {
  if (!claims || claims.length === 0) {
    return (
      <div className="bg-[#141518] rounded-2xl p-4">
        <h3 className="text-sm font-bold mb-1">Claim history</h3>
        <p className="text-xs text-[#F2F7F4]/40">No claims yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-3">
      <h3 className="text-sm font-bold">Claim history</h3>
      <div className="space-y-2">
        {claims.map((claim) => (
          <div key={claim.id} className="bg-black/25 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-sm font-bold text-[#F2F7F4]">
                {fmtXlm(claim.amount_xlm)} XLM
              </span>
              <ClaimStatusChip status={claim.status} />
            </div>
            <p className="text-[10px] text-[#F2F7F4]/40">
              {claim.event_count || 0} rewarded {claim.event_count === 1 ? 'action' : 'actions'} ·{' '}
              {new Date(claim.created_date).toLocaleDateString()}
              {claim.paid_date ? ` · paid ${new Date(claim.paid_date).toLocaleDateString()}` : ''}
            </p>
            {claim.review_note && (
              <p className="text-[10px] text-[#F2F7F4]/60">Reviewer: {claim.review_note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}