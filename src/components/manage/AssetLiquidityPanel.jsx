import { useEffect, useState } from 'react';
import AssetPressure from '@/components/AssetPressure';
import MarketStatsGrid from '@/components/manage/MarketStatsGrid';
import PoolReserves from '@/components/manage/PoolReserves';
import { loadAssetData } from '@/lib/assetData';
import { liquidityGrowth } from '@/lib/liquidity';
import { assetCode, assetIssuer, assetMeta, marketQuotes } from '@/lib/registry';

// Everything the network knows about this asset's liquidity: what sits in each
// pool, how deep it is, and who is buying or selling across the last day.
export default function AssetLiquidityPanel({ kind, record }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const code = assetCode(record);
  const issuer = assetIssuer(record, kind);

  useEffect(() => {
    if (!code || !issuer) {
      setData(null);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    loadAssetData({
      code,
      issuer,
      quotes: marketQuotes(record, kind),
      limit: 100,
      meta: assetMeta(record, kind),
    })
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch(() => {
        if (active) setData(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code, issuer, kind, record?.id]);

  if (loading) {
    return (
      <div className="bg-[#141518] rounded-2xl p-6 flex justify-center">
        <div className="w-5 h-5 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-[#141518] rounded-2xl p-4">
        <p className="text-sm text-white/40">
          Nothing on the network for this asset yet — no pool, no offers, no trades.
        </p>
      </div>
    );
  }

  const growth = liquidityGrowth(data.market?.markets, data.stats?.trades, data.xlmPerUsdc);

  return (
    <div className="space-y-3">
      <PoolReserves
        markets={data.market?.markets}
        symbol={code}
        xlmPerUsdc={data.xlmPerUsdc}
      />
      <MarketStatsGrid data={data} growth={growth} record={record} symbol={code} />
      <AssetPressure
        pressure={data.pressure}
        depth={data.depth}
        symbol={code}
        quote={data.pools?.[0] || 'xlm'}
      />
    </div>
  );
}