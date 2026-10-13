import StatRow from '@/components/manage/StatRow';
import { poolLabel } from '@/lib/pools';
import { COLLECTION, assetCode, assetIssuer } from '@/lib/registry';
import { shortAddr } from '@/lib/profiles';

const CURVES = { slow: 'Slow', medium: 'Medium', fast: 'Fast', hyper: 'Hyper' };

// How the asset was launched, and the on-chain identity wallets resolve it by —
// the facts behind every figure on this screen.
export default function LaunchFacts({ kind, record }) {
  const code = assetCode(record);
  const issuer = assetIssuer(record, kind);
  const isCollection = kind === COLLECTION;

  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-2.5">
      <div>
        <h3 className="font-bold text-sm text-white/80">Launch &amp; on-chain</h3>
        <p className="text-[10px] text-white/30 mt-0.5">
          What was minted, and the identity the network resolves the registry by
        </p>
      </div>

      <StatRow label="Asset code" value={code || '—'} />
      <StatRow label="Issuer" value={issuer ? shortAddr(issuer) : '—'} />
      <StatRow label="Metadata domain" value={record?.custom_domain || record?.home_domain || '—'} />

      {isCollection ? (
        <>
          <StatRow
            label="Editions"
            value={
              record?.edition_type === 'limited'
                ? `${(record?.minted_count || 0).toLocaleString()} / ${(record?.total_supply || 0).toLocaleString()}`
                : `Unique · ${(record?.minted_count || 0).toLocaleString()} minted`
            }
          />
          <StatRow
            label="Mint price"
            value={`${record?.mint_price ?? 0} ${(record?.quote || 'xlm').toUpperCase()}`}
          />
          <StatRow label="Royalty" value={`${record?.royalty_percent || 0}%`} />
          <StatRow label="Status" value={record?.status || 'live'} />
        </>
      ) : (
        <>
          <StatRow label="Supply" value={(record?.supply || 0).toLocaleString()} />
          <StatRow label="Liquidity pools" value={poolLabel(record?.pools)} />
          <StatRow label="Curve" value={CURVES[record?.curve] || record?.curve || '—'} />
          <StatRow
            label="Pooled at launch"
            value={record?.is_auto_pool ? 'Whole supply in the pool' : `${record?.liquidity_percent ?? 100}% of supply`}
          />
        </>
      )}
    </div>
  );
}