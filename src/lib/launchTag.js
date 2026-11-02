// Compact launch tag for token rows: which system launched the token, and how
// much of the supply it committed. A locked launch keeps nothing for the creator
// in 100% mode, which is how the split is read back from the record.
export function launchTag(token) {
  if (!token) return '';
  if (token.launch_model === 'locked') {
    const creator = parseFloat(token.creator_allocation) || 0;
    return creator > 0 ? 'Locked 50%' : 'Locked 100%';
  }
  if (token.is_auto_pool) return 'Auto-Pool 100%';
  const liq = token.liquidity_percent != null ? token.liquidity_percent : 100;
  return `Curve ${liq}%`;
}