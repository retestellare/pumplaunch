import { QUOTES, tokenPools } from '@/lib/pools';

// Marks which market(s) a token trades in, at a glance in any list.
export default function PoolBadge({ token }) {
  const pools = tokenPools(token);
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {pools.map((key) => {
        const quote = QUOTES[key];
        return (
          <span
            key={key}
            style={{ color: quote.color, background: `${quote.color}1f` }}
            className="text-[9px] px-1.5 py-0.5 rounded font-bold"
          >
            {quote.label}
          </span>
        );
      })}
    </span>
  );
}