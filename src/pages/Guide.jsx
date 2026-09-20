import { Link } from 'react-router-dom';
import { ChevronLeft, HelpCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import {
  Wallet,
  Rocket,
  ArrowLeftRight,
  ListOrdered,
  Users,
  Briefcase,
  MessageCircle,
  Sparkles,
  UserPlus,
  Trophy,
  TrendingUp,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: Wallet,
    title: 'Connecting Your Wallet',
    desc: 'Stellar Pump runs entirely on the Stellar mainnet. Before you can trade or launch, connect a supported wallet (Freighter, Albedo, xBull, or Rabet).',
    tip: 'Tap the wallet button in the top-right of any page to connect. Every transaction is signed by your wallet — your keys never leave it.',
  },
  {
    icon: Rocket,
    title: 'Launching a Token',
    desc: 'Create your own memecoin with a permanently locked issuer account. Choose a name, symbol, supply, an optional logo, and optionally a custom domain for your stellar.toml metadata.',
    tip: 'Pick a distribution mode: 100% Liquidity seeds a bonding curve, split modes keep some in your wallet, or 100% Auto-Pool seeds a native Stellar liquidity pool directly.',
  },
  {
    icon: TrendingUp,
    title: 'Price Curves & Auto-Pool',
    desc: 'When launching with a bonding curve, choose Slow / Medium / Fast / Hyper — faster curves raise price more aggressively after early buys. In 100% Auto-Pool mode, the total supply is derived from your initial XLM liquidity and all of it goes into the pool.',
    tip: 'Auto-Pool needs at least 10 XLM. More initial liquidity means a larger supply and lower starting price slippage.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Trading — Market, Limit & Pool',
    desc: 'On any token detail page, trade using three modes. Market buys/sells instantly against open offers. Limit places an on-chain order at your chosen price. Pool swaps route through the Stellar liquidity pool (for Auto-Pool tokens).',
    tip: 'Each trade shows an estimated fee and balance check before you confirm. Real XLM is spent — always review the confirmation screen.',
  },
  {
    icon: ListOrdered,
    title: 'Open Orders & Canceling',
    desc: 'Limit orders live on-chain as Stellar offers. The Open Orders section on each token page lists your active buy/sell offers.',
    tip: 'Tap Cancel next to any order to remove it from the ledger. Cancelled orders free up your reserved XLM or tokens.',
  },
  {
    icon: Users,
    title: 'Token Holders',
    desc: 'See every wallet that holds a token, sorted by balance, with each holder\u2019s percentage of the total supply.',
    tip: 'Tap the holder count badge on any token card (or the holders link on a token page) to open the full holders list.',
  },
  {
    icon: Briefcase,
    title: 'Portfolio & Balances',
    desc: 'The Portfolio page shows your available XLM, every trustline asset you hold, enriched with on-chain metadata, and your recent trading activity.',
    tip: 'Requires a connected wallet. Your balances are read live from the Stellar ledger each time you open the page.',
  },
  {
    icon: MessageCircle,
    title: 'Social Feed',
    desc: 'Share trades, positions, and P&L with the community. Post messages, attach a token, and like or comment on others\u2019 posts.',
    tip: 'Use the Social tab in the bottom nav. Your connected wallet address appears as your identity on posts.',
  },
  {
    icon: Sparkles,
    title: 'The New Tab',
    desc: 'The New tab on the home page filters to tokens launched today (UTC), sorted newest first.',
    tip: 'Use it to spot fresh launches the moment they hit the market.',
  },
  {
    icon: UserPlus,
    title: 'New Holders Today',
    desc: 'This home-page section lists wallet addresses that acquired any tracked token in the last 24 hours, pulled live from on-chain trades.',
    tip: 'A quick way to see which tokens are gaining new attention right now.',
  },
  {
    icon: Trophy,
    title: 'Top Earners Leaderboard',
    desc: 'Ranks wallets by all-time realized P&L — the total XLM gained from sells minus XLM spent on buys across every app token. Positive profits are green, losses are red.',
    tip: 'If you\u2019ve traded, your own row is highlighted. You\u2019ll also see your rank even if you\u2019re outside the top 50.',
  },
];

function GuideSection({ icon: Icon, title, desc, tip }) {
  return (
    <div className="bg-[#141518] rounded-2xl p-4 space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#00ff88]/10 flex items-center justify-center">
          <Icon size={18} className="text-[#00ff88]" />
        </div>
        <h3 className="font-bold text-sm">{title}</h3>
      </div>
      <p className="text-xs text-white/55 leading-relaxed">{desc}</p>
      <div className="bg-[#00ff88]/5 border border-[#00ff88]/15 rounded-xl px-3 py-2">
        <p className="text-[11px] text-white/70 leading-relaxed">
          <span className="text-[#00ff88] font-bold">How to use: </span>
          {tip}
        </p>
      </div>
    </div>
  );
}

export default function Guide() {
  return (
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-20">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5">
        <div className="flex items-center gap-3 px-4 h-14">
          <Link to="/" className="text-white/70">
            <ChevronLeft size={22} />
          </Link>
          <div className="flex items-center gap-2">
            <HelpCircle size={18} className="text-[#00ff88]" />
            <h1 className="text-lg font-bold tracking-tight">App Guide</h1>
          </div>
        </div>
      </header>
      <main className="p-4 space-y-3">
        <p className="text-sm text-white/50 px-1">
          Everything you can do on Stellar Pump — real mainnet trading, token launches, and more.
        </p>
        {SECTIONS.map((s) => (
          <GuideSection key={s.title} {...s} />
        ))}
        <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-2xl p-4 mt-2">
          <p className="text-xs text-white/60 leading-relaxed">
            ⚠ Stellar Pump operates on the Stellar <span className="font-bold">mainnet</span>. All
            transactions use real XLM and are irreversible. Always confirm the details on the review
            screen before signing in your wallet.
          </p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}