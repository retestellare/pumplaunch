import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import { useWallet } from '@/lib/wallet';
import { loadAssetData } from '@/lib/assetData';
import { mapLimit } from '@/lib/concurrency';
import { toXlm } from '@/lib/pools';
import {
  COLLECTION,
  REGISTRY_FILE,
  TOKEN,
  assetCode,
  assetIssuer,
  assetMeta,
  loadCreatedAssets,
  marketQuotes,
} from '@/lib/registry';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import ManagedAssetRow from '@/components/manage/ManagedAssetRow';

const CONCURRENCY = 3;

// Everything the connected wallet launched, each row carrying what the registry
// publishes for it and a live read of its liquidity. Tapping one opens the
// manager for that asset.
export default function AssetManager() {
  const { wallet } = useWallet();
  const goBack = useGoBack('/portfolio');
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wallet?.address) {
      setAssets([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);

    (async () => {
      try {
        const { tokens, collections } = await loadCreatedAssets(wallet.address);
        const list = [
          ...tokens.map((record) => ({ kind: TOKEN, record, data: null })),
          ...collections.map((record) => ({ kind: COLLECTION, record, data: null })),
        ];
        if (!active) return;
        setAssets(list);
        setLoading(false);

        // On-chain figures stream in row by row, so the list never waits on Horizon.
        await mapLimit(list, CONCURRENCY, async (item) => {
          const code = assetCode(item.record);
          const issuer = assetIssuer(item.record, item.kind);
          if (!code || !issuer) return;

          let loaded = null;
          try {
            loaded = await loadAssetData({
              code,
              issuer,
              quotes: marketQuotes(item.record, item.kind),
              limit: 50,
              meta: assetMeta(item.record, item.kind),
            });
          } catch {
            return;
          }
          if (!active || !loaded) return;

          const pool = loaded.market?.pool;
          const data = {
            price: loaded.price || 0,
            change24h: loaded.change24h ?? null,
            volume24h: loaded.volume24h || 0,
            holders: loaded.holders || 0,
            pressure: loaded.pressure || null,
            depth: loaded.depth || null,
            poolXlm: pool ? toXlm(pool.quoteReserve, pool.quote, loaded.xlmPerUsdc) : 0,
          };
          setAssets((prev) =>
            prev.map((p) => (p.record.id === item.record.id ? { ...p, data } : p))
          );
        });
      } catch {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [wallet?.address]);

  return (
    <PageLayout title="Asset Manager" rightAction={<WalletButton />}>
      <div className="p-4">
        <button
          onClick={goBack}
          className="flex items-center gap-1 text-xs text-white/40 mb-3"
        >
          <ChevronLeft size={14} /> Back
        </button>

        {!wallet ? (
          <p className="text-sm text-white/50 py-16 text-center">
            Connect your wallet to manage the assets you launched
          </p>
        ) : (
          <>
            <div className="bg-[#141518] rounded-2xl p-4 mb-3">
              <h2 className="text-sm font-bold">Your launches, under your control</h2>
              <p className="text-[11px] text-white/40 mt-1">
                Edit the stellar.toml entry of anything you launched, republish it, and read every
                liquidity figure behind it — pools, reserves, depth, pressure and volume.
              </p>
              <p className="text-[10px] text-white/30 mt-2">
                Wallets read {REGISTRY_FILE}; the live registry rebuilds itself from these records.
              </p>
            </div>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
              </div>
            ) : assets.length === 0 ? (
              <div className="bg-[#141518] rounded-2xl p-5 text-center">
                <p className="text-sm text-white/60">Nothing launched from this wallet yet.</p>
                <div className="flex gap-2 mt-3">
                  <Link
                    to="/launch"
                    className="flex-1 py-2.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm"
                  >
                    Launch a token
                  </Link>
                  <Link
                    to="/launch-nft"
                    className="flex-1 py-2.5 rounded-xl bg-white/5 font-bold text-sm"
                  >
                    Launch an NFT drop
                  </Link>
                </div>
              </div>
            ) : (
              assets.map((item) => (
                <ManagedAssetRow
                  key={`${item.kind}-${item.record.id}`}
                  kind={item.kind}
                  record={item.record}
                  data={item.data}
                />
              ))
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}