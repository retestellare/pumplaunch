import { useEffect, useMemo, useState } from 'react';
import { fetchNewHolders } from '@/lib/leaderboard';
import TickerTape from '@/components/ticker/TickerTape';
import TokenIcon from '@/components/TokenIcon';

// Only the hottest tokens are swept for buys — one Horizon sweep is expensive.
const BUY_TOKENS = 14;

function fmtPrice(price) {
  const n = Number(price);
  if (!n) return '$0.00';
  if (n >= 1) return `$${n.toFixed(4)}`;
  if (n >= 0.001) return `$${n.toFixed(6)}`;
  return `$${n.toFixed(8)}`;
}

function ago(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
}

const shortAddr = (addr) => `${addr.slice(0, 4)}…${addr.slice(-4)}`;

function PriceItem({ token }) {
  const change = token.change_24h;
  const has = change != null && !isNaN(change);
  const up = (change ?? 0) >= 0;
  return (
    <div className="flex items-center gap-1.5 pl-2 pr-3 shrink-0">
      <TokenIcon token={token} size={20} shape="square" />
      <span className="font-extrabold text-[11px] whitespace-nowrap">${token.symbol}</span>
      <span className="font-mono text-[10px] text-[#F2F7F4]/55 tabular-nums whitespace-nowrap">
        {fmtPrice(token.price)}
      </span>
      <span
        className={`text-[10px] font-extrabold tabular-nums whitespace-nowrap ${
          has ? (up ? 'text-[#00F59B]' : 'text-[#ff4d6d]') : 'text-[#F2F7F4]/30'
        }`}
      >
        {has ? `${up ? '▲' : '▼'}${Math.abs(change).toFixed(2)}%` : '—'}
      </span>
    </div>
  );
}

function BuyItem({ buy, token }) {
  return (
    <div className="flex items-center gap-1.5 pl-2 pr-3 shrink-0">
      {token ? (
        <TokenIcon token={token} size={18} />
      ) : (
        <span className="w-[18px] h-[18px] rounded-full bg-[#16211E] shrink-0" />
      )}
      <span className="text-[10px] font-extrabold text-[#00F59B] whitespace-nowrap">
        {buy.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${buy.tokenSymbol}
      </span>
      <span className="text-[10px] text-[#F2F7F4]/40 whitespace-nowrap">
        bought · {shortAddr(buy.address)} · {ago(buy.time)}
      </span>
    </div>
  );
}

export default function MarketTicker({ tokens }) {
  const [buys, setBuys] = useState([]);

  const hot = useMemo(
    () => tokens.filter((t) => t.issuer && t.asset_code).slice(0, BUY_TOKENS),
    [tokens]
  );
  const hotKey = hot.map((t) => t.id).join(',');

  useEffect(() => {
    if (!hotKey) return;
    let active = true;
    fetchNewHolders(hot)
      .then((rows) => {
        if (active) setBuys(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [hotKey]);

  const priced = tokens.filter((t) => Number(t.price) > 0);
  if (priced.length === 0 && buys.length === 0) return null;

  const bySymbol = {};
  tokens.forEach((t) => {
    if (t.symbol) bySymbol[t.symbol] = t;
  });

  return (
    <div className="rounded-[12px] overflow-hidden border border-[#00F59B]/20 bg-[#0c1512]/70 backdrop-blur-[6px]">
      {priced.length > 0 && (
        <TickerTape duration={Math.min(120, Math.max(18, priced.length * 2))} className="py-[5px]">
          {priced.map((t) => (
            <PriceItem key={t.id} token={t} />
          ))}
        </TickerTape>
      )}
      {buys.length > 0 && (
        <TickerTape
          duration={Math.max(18, buys.length * 3)}
          reverse
          className="py-[6px] border-t border-[#00F59B]/15"
        >
          {buys.map((b, i) => (
            <BuyItem key={b.address + i} buy={b} token={bySymbol[b.tokenSymbol]} />
          ))}
        </TickerTape>
      )}
    </div>
  );
}