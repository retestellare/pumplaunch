import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import useGoBack from '@/hooks/useGoBack';
import TokenIcon from '@/components/TokenIcon';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import AssetLiquidityPanel from '@/components/manage/AssetLiquidityPanel';
import LaunchFacts from '@/components/manage/LaunchFacts';
import RegistryEditor from '@/components/manage/RegistryEditor';
import { shortAddr } from '@/lib/profiles';
import {
  COLLECTION,
  TOKEN,
  assetCode,
  assetImage,
  assetIssuer,
  entityFor,
} from '@/lib/registry';

// One launched asset, managed end to end: the registry entry it publishes, the
// facts behind it, and every liquidity figure the network reports for it.
export default function ManageAsset() {
  const { kind, id } = useParams();
  const goBack = useGoBack('/manage');
  const valid = kind === TOKEN || kind === COLLECTION;
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!valid) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    entityFor(kind)
      .get(id)
      .then((found) => {
        if (active) setRecord(found);
      })
      .catch(() => {
        if (active) setRecord(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, id, valid]);

  const code = assetCode(record);
  const issuer = assetIssuer(record, kind);
  const explorerUrl =
    code && issuer ? `https://stellar.expert/explorer/public/asset/${code}-${issuer}` : null;

  return (
    <PageLayout title={record ? `$${code}` : 'Manage asset'} rightAction={<WalletButton />}>
      <div className="p-4 space-y-3">
        <button onClick={goBack} className="flex items-center gap-1 text-xs text-white/40">
          <ChevronLeft size={14} /> Asset Manager
        </button>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
          </div>
        ) : !record ? (
          <p className="text-sm text-white/50 py-16 text-center">
            This asset is no longer available.
          </p>
        ) : (
          <>
            <div className="bg-[#141518] rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <TokenIcon token={{ symbol: code, image_url: assetImage(record, kind) }} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-base shrink-0">${code || '—'}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 font-bold shrink-0">
                      {kind === COLLECTION ? 'NFT DROP' : 'TOKEN'}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 truncate">{record.name || '—'}</p>
                  {issuer && (
                    <p className="text-[10px] text-white/30 font-mono mt-0.5">
                      {shortAddr(issuer)}
                    </p>
                  )}
                </div>
              </div>
              {explorerUrl && (
                <a
                  href={explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#00ff88] mt-3"
                >
                  View on Stellar Expert <ExternalLink size={12} />
                </a>
              )}
            </div>

            <RegistryEditor kind={kind} record={record} onSaved={setRecord} />
            <LaunchFacts kind={kind} record={record} />
            <AssetLiquidityPanel kind={kind} record={record} />

            {kind === TOKEN && (
              <Link
                to={`/token/${record.id}`}
                className="block text-center py-3 rounded-xl bg-white/5 font-bold text-sm"
              >
                Open the trading page
              </Link>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}