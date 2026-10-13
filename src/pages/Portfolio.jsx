import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useWallet } from '@/lib/wallet';
import { loadAccount, parseBalances } from '@/lib/stellar';
import { loadAssetData } from '@/lib/assetData';
import { fetchTokenCosts, portfolioPnl } from '@/lib/positions';
import { mapLimit } from '@/lib/concurrency';
import { resolveProfile, shortAddr } from '@/lib/profiles';
import PageLayout from '@/components/PageLayout';
import WalletButton from '@/components/WalletButton';
import Avatar from '@/components/Avatar';
import ProfileEditor from '@/components/ProfileEditor';
import XAccountRow from '@/components/XAccountRow';
import WalletAssetRow from '@/components/wallet/WalletAssetRow';
import AssetManagerEntry from '@/components/wallet/AssetManagerEntry';
import { Pencil } from 'lucide-react';

// How many assets are priced at once: fast enough to feel live, gentle on Horizon.
const ASSET_CONCURRENCY = 3;

const TABS = [
  { value: 'assets', label: 'Assets' },
  { value: 'activity', label: 'Activity' },
  { value: 'messages', label: 'Messages' },
];

function fmtXlm(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K XLM`;
  return `${v.toLocaleString(undefined, { maximumFractionDigits: 4 })} XLM`;
}

function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function Portfolio() {
  const { wallet } = useWallet();
  const [balances, setBalances] = useState(null);
  const [enrichedAssets, setEnrichedAssets] = useState([]);
  const [profile, setProfile] = useState(null);
  const [tab, setTab] = useState('assets');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [trades, setTrades] = useState([]);
  const [activities, setActivities] = useState([]);
  const [launches, setLaunches] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [costs, setCosts] = useState({});

  // Load balances + profile
  useEffect(() => {
    if (!wallet?.address) {
      setBalances(null);
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [account, p] = await Promise.all([
          loadAccount(wallet.address),
          resolveProfile(wallet.address),
        ]);
        if (!active) return;
        setBalances(account ? parseBalances(account) : { xlm: 0, assets: [], availableXlm: 0 });
        setProfile(p);
      } catch {
        if (active) setBalances({ xlm: 0, assets: [], availableXlm: 0 });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [wallet?.address]);

  // What each token cost this wallet, read once from the app's own trade log, so
  // every row can show the gain or loss sitting behind its balance.
  useEffect(() => {
    if (!wallet?.address) {
      setCosts({});
      return;
    }
    let active = true;
    fetchTokenCosts(wallet.address)
      .then((fetched) => {
        if (active) setCosts(fetched);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [wallet?.address]);

  // Every asset gets live on-chain figures — its price, what the holding is worth,
  // buy/sell pressure and book depth — streamed in row by row, so the list never
  // waits on Horizon.
  useEffect(() => {
    if (!balances?.assets?.length) {
      setEnrichedAssets([]);
      return;
    }
    let active = true;
    setEnrichedAssets(balances.assets.map((a) => ({ ...a, symbol: a.code })));

    (async () => {
      let tokens = [];
      let collections = [];
      try {
        [tokens, collections] = await Promise.all([
          base44.entities.Token.list('-created_date', 300),
          base44.entities.NftCollection.list('-created_date', 300),
        ]);
      } catch {
        /* the rows still show their plain balances */
      }

      const tokenByIssuer = {};
      for (const t of tokens || []) if (t.issuer) tokenByIssuer[t.issuer] = t;
      // A collection's editions are a Stellar asset too, so its artwork belongs
      // on the same wallet row as the balance.
      const nftByIssuer = {};
      for (const c of collections || []) {
        if (c.issuer_public_key) nftByIssuer[c.issuer_public_key] = c;
      }

      await mapLimit(balances.assets, ASSET_CONCURRENCY, async (a) => {
        const appToken = tokenByIssuer[a.issuer];
        const appNft = nftByIssuer[a.issuer];
        const meta = appToken
          ? {
              name: appToken.name,
              logo: appToken.image_url,
              homeDomain: appToken.custom_domain || appToken.home_domain,
            }
          : appNft
          ? { name: appNft.name, logo: appNft.media_url, homeDomain: appNft.home_domain }
          : undefined;

        let data = null;
        try {
          data = await loadAssetData({ code: a.code, issuer: a.issuer, limit: 50, meta });
        } catch {
          /* this asset has no market data to show */
        }
        if (!active) return;

        const row = {
          ...a,
          symbol: appToken?.symbol || a.code,
          name: appToken?.name || appNft?.name || data?.meta?.name || a.code,
          token_id: appToken?.id || null,
          image_url: appToken?.image_url || appNft?.media_url || data?.meta?.logo || null,
          domain:
            appToken?.custom_domain ||
            appToken?.home_domain ||
            appNft?.home_domain ||
            data?.meta?.homeDomain ||
            null,
          price: data?.price || null,
          change24h: data?.change24h ?? null,
          pressure: data?.pressure || null,
          depth: data?.depth || null,
        };
        setEnrichedAssets((prev) =>
          prev.map((p) => (p.code === a.code && p.issuer === a.issuer ? row : p))
        );
      });
    })();

    return () => {
      active = false;
    };
  }, [balances]);

  // Load history (activity + messages) when tab opened
  useEffect(() => {
    if (!wallet?.address) return;
    if (tab !== 'activity' && tab !== 'messages') return;
    let active = true;
    setLoadingHistory(true);
    (async () => {
      try {
        if (tab === 'activity') {
          const [tradeList, actList, launchList] = await Promise.all([
            base44.entities.Trade.filter({ user_address: wallet.address }, '-created_date', 50),
            base44.entities.Activity.filter({ wallet_address: wallet.address }, '-created_date', 50),
            base44.entities.Token.filter({ creator: wallet.address }, '-created_date', 50),
          ]);
          if (!active) return;
          setTrades(tradeList || []);
          setActivities(actList || []);
          setLaunches(launchList || []);
        } else {
          const [myPosts, myComments] = await Promise.all([
            base44.entities.Post.filter({ author: wallet.address }, '-created_date', 50),
            base44.entities.Comment.filter({ author: wallet.address }, '-created_date', 50),
          ]);
          const myPostIds = (myPosts || []).map((p) => p.id);
          const othersComments = myPostIds.length
            ? await base44.entities.Comment.filter({ post_id: { $in: myPostIds } }, '-created_date', 50)
            : [];
          if (!active) return;
          const combined = [
            ...(myPosts || []).map((p) => ({
              id: p.id,
              kind: 'Your post',
              content: p.content,
              tag: p.token_symbol,
              author: p.author,
              time: p.created_date,
            })),
            ...(myComments || []).map((c) => ({
              id: c.id,
              kind: 'Your comment',
              content: c.content,
              author: c.author,
              time: c.created_date,
            })),
            ...(othersComments || [])
              .filter((c) => c.author !== wallet.address)
              .map((c) => ({
                id: c.id,
                kind: 'Comment on your post',
                content: c.content,
                author: c.author,
                time: c.created_date,
              })),
          ].sort((a, b) => new Date(b.time) - new Date(a.time));
          setMessages(combined);
        }
      } catch {
        /* ignore */
      } finally {
        if (active) setLoadingHistory(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [tab, wallet?.address]);

  const onProfileSaved = async () => {
    setEditing(false);
    if (wallet?.address) {
      const p = await resolveProfile(wallet.address);
      setProfile(p);
    }
  };

  if (!wallet) {
    return (
      <PageLayout title="Wallet" rightAction={<WalletButton />}>
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <p className="text-white/50">Connect your wallet to view your profile and portfolio</p>
        </div>
      </PageLayout>
    );
  }

  // Build merged activity feed
  const activityFeed = [
    ...(trades || []).map((t) => ({
      id: `trade-${t.id}`,
      type: t.type === 'buy' ? 'buy' : 'sell',
      label: `${t.type === 'buy' ? 'Buy' : 'Sell'} $${t.token_symbol || ''}`,
      value: `${(t.amount_xlm || 0).toFixed(2)} XLM`,
      color: t.type === 'buy' ? '#00ff88' : '#ff3b5c',
      tokenId: t.token_id,
      time: t.created_date,
    })),
    ...(activities || []).map((a) => ({
      id: `act-${a.id}`,
      type: a.type,
      label:
        a.type === 'launch'
          ? `Launched $${a.token_symbol || ''}`
          : a.type === 'pool_seed'
          ? `Seeded pool $${a.token_symbol || ''}`
          : a.type === 'order_placed'
          ? `Limit order $${a.token_symbol || ''}`
          : `Cancelled order $${a.token_symbol || ''}`,
      value: a.details || (a.amount_xlm ? `${a.amount_xlm.toFixed(2)} XLM` : ''),
      color: '#3b82f6',
      tokenId: a.token_id,
      time: a.created_date,
    })),
    ...(launches || []).map((t) => ({
      id: `launch-${t.id}`,
      type: 'launch',
      label: `Launched $${t.symbol}`,
      value: `${(t.supply || 0).toLocaleString()} supply`,
      color: '#3b82f6',
      tokenId: t.id,
      time: t.created_date,
    })),
  ].sort((a, b) => new Date(b.time) - new Date(a.time));

  // Gains and losses across every asset bought on-chain, net of what has already
  // been sold back out of it.
  const portfolio = portfolioPnl(
    enrichedAssets.length > 0 ? enrichedAssets : balances?.assets,
    costs
  );

  return (
    <PageLayout title="Wallet" rightAction={<WalletButton />}>
      {/* Profile header card */}
      <div className="p-4">
        <div className="bg-gradient-to-br from-[#00ff88]/10 to-[#141518] rounded-2xl p-5 border border-[#00ff88]/20">
          <div className="flex items-center gap-4">
            <Avatar profile={profile} address={wallet.address} size={64} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold truncate">
                  {profile?.display_name || 'No profile yet'}
                </h2>
                <button
                  onClick={() => setEditing(true)}
                  className="text-white/40 hover:text-[#00ff88] transition"
                >
                  <Pencil size={14} />
                </button>
              </div>
              <p className="text-xs text-white/30 font-mono mt-0.5">{shortAddr(wallet.address)}</p>
            </div>
          </div>
          {profile?.bio && (
            <p className="text-sm text-white/60 mt-3 whitespace-pre-wrap">{profile.bio}</p>
          )}
          {profile && <XAccountRow handle={profile.x_handle} onConnect={() => setEditing(true)} />}
          {!profile && (
            <button
              onClick={() => setEditing(true)}
              className="w-full mt-3 py-2.5 rounded-xl bg-[#00ff88] text-black font-bold text-sm"
            >
              Set Up Your Profile
            </button>
          )}
        </div>
      </div>

      {/* Balance card */}
      <div className="px-4">
        <div className="bg-[#141518] rounded-2xl p-4">
          <div className="text-xs text-white/40">Total Balance</div>
          <div className="text-2xl font-bold mt-1">
            {loading ? '…' : (balances?.xlm || 0).toFixed(2)}{' '}
            <span className="text-sm text-white/50">XLM</span>
          </div>
          {balances && balances.availableXlm < balances.xlm && (
            <div className="text-xs text-white/40 mt-1">
              {balances.availableXlm.toFixed(2)} XLM available
            </div>
          )}
          {portfolio && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
              <span className="text-xs text-white/40">Tokens</span>
              <span
                className={`text-xs font-bold ${
                  portfolio.pnl >= 0 ? 'text-[#00ff88]' : 'text-[#ff3b5c]'
                }`}
              >
                {portfolio.pnl >= 0 ? '+' : '−'}
                {fmtXlm(Math.abs(portfolio.pnl))} · {portfolio.pct >= 0 ? '↑' : '↓'}
                {Math.abs(portfolio.pct).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-3 pt-4 sticky top-14 z-20 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`flex-1 py-2.5 text-sm font-bold transition ${
              tab === t.value
                ? 'text-white border-b-2 border-[#00ff88]'
                : 'text-white/40 border-b-2 border-transparent'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'assets' && (
          <>
            <AssetManagerEntry address={wallet.address} />
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
              </div>
            ) : !balances || balances.assets.length === 0 ? (
              <p className="text-sm text-white/30">No trustline assets yet.</p>
            ) : (
              (enrichedAssets.length > 0 ? enrichedAssets : balances.assets).map((a) => (
                <WalletAssetRow
                  key={`${a.code}:${a.issuer}`}
                  asset={a}
                  cost={costs[a.token_id]}
                />
              ))
            )}
          </>
        )}

        {tab === 'activity' && (
          <>
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
              </div>
            ) : activityFeed.length === 0 ? (
              <p className="text-sm text-white/30">No on-chain activity yet.</p>
            ) : (
              <div className="space-y-2">
                {activityFeed.map((item) => {
                  const inner = (
                    <div className="flex items-center justify-between px-3 py-2.5 bg-[#141518] rounded-xl text-sm">
                      <div className="min-w-0">
                        <div className="font-medium" style={{ color: item.color }}>
                          {item.label}
                        </div>
                        {item.value && <div className="text-xs text-white/40 truncate">{item.value}</div>}
                      </div>
                      <div className="text-xs text-white/30 flex-shrink-0 ml-2">{timeAgo(item.time)}</div>
                    </div>
                  );
                  return item.tokenId ? (
                    <Link key={item.id} to={`/token/${item.tokenId}`}>{inner}</Link>
                  ) : (
                    <div key={item.id}>{inner}</div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'messages' && (
          <>
            {loadingHistory ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-white/30">No social activity yet. Share a callout in the Social feed!</p>
            ) : (
              <div className="space-y-2">
                {messages.map((m) => (
                  <div key={m.id} className="px-3 py-3 bg-[#141518] rounded-xl">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-[#00ff88]">{m.kind}</span>
                      <span className="text-xs text-white/30">{timeAgo(m.time)}</span>
                    </div>
                    <p className="text-sm text-white/80 line-clamp-2">{m.content}</p>
                    {m.tag && (
                      <span className="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/60 font-bold">
                        ${m.tag}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-[#0a0b0d] max-w-lg mx-auto overflow-y-auto">
          <ProfileEditor onDone={onProfileSaved} />
        </div>
      )}
    </PageLayout>
  );
}