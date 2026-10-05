import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BottomNav from '@/components/BottomNav';
import TokenIcon from '@/components/TokenIcon';

const HORIZON_URL = 'https://horizon.stellar.org';

function shortAddr(addr) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

export default function TokenHolders() {
  const { id } = useParams();
  const [token, setToken] = useState(null);
  const [holders, setHolders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const t = await base44.entities.Token.get(id);
        if (!active) return;
        setToken(t);
        if (t.asset_code && t.issuer) {
          const res = await fetch(`${HORIZON_URL}/accounts?asset=${t.asset_code}:${t.issuer}&limit=200`);
          if (res.ok) {
            const data = await res.json();
            const records = (data._embedded?.records || [])
              .map((acc) => {
                const bal = (acc.balances || []).find(
                  (b) => b.asset_code === t.asset_code && b.asset_issuer === t.issuer
                );
                return { address: acc.account_id, balance: bal ? parseFloat(bal.balance) : 0 };
              })
              .filter((h) => h.balance > 0)
              .sort((a, b) => b.balance - a.balance);
            if (active) setHolders(records);
          }
        }
      } catch { /* ignore */ }
      if (active) setLoading(false);
    })();
    return () => { active = false; };
  }, [id]);

  const total = holders.reduce((s, h) => s + h.balance, 0);

  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to={token ? `/token/${token.id}` : '/'} className="text-white/70">
            <ChevronLeft size={22} />
          </Link>
          {token && <TokenIcon token={token} size={24} />}
          <span className="font-bold">
            Holders {token && <span className="text-white/40">· ${token.symbol}</span>}
          </span>
        </div>
      </header>
      <main className="p-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-white/10 border-t-[#00ff88] rounded-full animate-spin" />
          </div>
        ) : holders.length === 0 ? (
          <p className="text-center text-white/40 py-20 text-sm">No holders found onchain.</p>
        ) : (
          <>
            <p className="text-xs text-white/40 px-1">{holders.length} holders</p>
            {holders.map((h, i) => (
              <div key={h.address} className="flex items-center gap-3 px-4 py-3 bg-[#141518] rounded-xl">
                <span className="w-5 text-sm font-bold text-white/30">{i + 1}</span>
                <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold">
                  {h.address.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-mono text-white/80 truncate">{shortAddr(h.address)}</div>
                  <div className="text-[10px] text-white/30">
                    {total > 0 ? ((h.balance / total) * 100).toFixed(2) : 0}% of supply
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {h.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}