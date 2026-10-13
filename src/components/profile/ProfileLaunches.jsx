import TokenCard from '@/components/TokenCard';

// Everything this wallet launched through the app.
export default function ProfileLaunches({ tokens }) {
  if (tokens.length === 0) {
    return <p className="text-sm text-white/30 px-1 py-6 text-center">No tokens launched yet.</p>;
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-[#00ff88]/15 bg-[#0B1210]">
      {tokens.map((token, i) => (
        <TokenCard key={token.id} token={token} index={i} />
      ))}
    </div>
  );
}