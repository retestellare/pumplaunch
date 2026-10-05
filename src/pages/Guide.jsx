import { Link } from 'react-router-dom';
import { ChevronLeft, HelpCircle } from 'lucide-react';
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
  Droplets,
  Layers,
  RefreshCw,
  Globe,
  ShieldCheck,
  Coins,
  UserRound,
  Share2,
} from 'lucide-react';

const SECTIONS = [
  {
    icon: Wallet,
    title: 'Connecting Your Wallet',
    desc: 'Stellar Pump runs entirely on the Stellar mainnet. Before you can trade or launch, connect a supported wallet (Freighter, Albedo, xBull, or Rabet).',
    tip: 'Tap the wallet button in the top-right of any page to connect. Every transaction is signed by your wallet — your keys never leave it.',
  },
  {
    icon: Sparkles,
    title: 'Discovering Tokens',
    desc: 'The home page lists every token launched here with its live price and 24h change. Hot ranks by 24h trading volume, New shows launches from the last 24 hours, and Holders ranks by holder count.',
    tip: 'Figures stream in from the Stellar ledger while you browse, so a brand-new launch may fill in its numbers a moment after the list appears.',
  },
  {
    icon: Coins,
    title: 'Token Market Data',
    desc: 'Each token page shows a live price chart, 24h change, market cap, holder count, volume, liquidity depth and best prices, alongside the launch method and supply details.',
    tip: 'A market badge marks tokens that trade against XLM, USDC, or both — USDC figures are converted to XLM so every token compares the same way.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Trading — Market, Limit & Pool',
    desc: 'On any token page, trade three ways. Market fills instantly along the best available route (liquidity pool or order book). Limit places a real on-chain Stellar offer at your price. Pool swaps route through the token\u2019s liquidity pool.',
    tip: 'Every order shows its estimated fee and reserves before you confirm. A USDC trustline is added automatically the first time you trade a USDC market.',
  },
  {
    icon: ListOrdered,
    title: 'Open Orders & Canceling',
    desc: 'Limit orders live on-chain as Stellar offers. The Open Orders section on each token page lists your active buy/sell offers.',
    tip: 'Tap Cancel next to any order to remove it from the ledger. Cancelled orders free up your reserved XLM or tokens.',
  },
  {
    icon: Droplets,
    title: 'Seeding a Liquidity Pool',
    desc: 'Any holder can add liquidity from a token page: deposit XLM together with the matching tokens to create the pool, or top up the existing one.',
    tip: 'Pool swaps only work once a pool exists — seeding is how a bonding-curve token gains a pool market.',
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
    desc: 'The Portfolio page shows your available XLM, every trustline asset you hold enriched with on-chain metadata, and your recent trading activity.',
    tip: 'Requires a connected wallet. Your balances are read live from the Stellar ledger each time you open the page.',
  },
  {
    icon: Rocket,
    title: 'Launching — Token Details',
    desc: 'Start with the basics: name, symbol (4\u201312 letters or numbers), description, total supply and an optional logo. Supply is fixed forever — the issuing account is locked the moment you launch.',
    tip: 'If your wallet already holds a token with that symbol, the launch reuses it instead of creating a duplicate.',
  },
  {
    icon: Layers,
    title: 'Launching — Market & Pool',
    desc: 'New launches create a Single Pool against XLM. Initial Liquidity is the amount you seed into the pool when the token launches.',
    tip: 'Minimum 10 XLM — 50 or more recommended for lower initial price slippage. Tokens that already trade against USDC keep that market.',
  },
  {
    icon: TrendingUp,
    title: 'Launching — Supply Distribution & Curve',
    desc: '100% Liquidity seeds the whole supply onto the DEX bonding curve, 80/20 keeps 20% in your wallet and seeds the rest, and 100% Auto-Pool sends all of it into the Stellar liquidity pool. Curve launches also choose a pace: Slow or Fast.',
    tip: 'Fast raises the price more aggressively after early buys, so later buyers pay more.',
  },
  {
    icon: RefreshCw,
    title: 'Launch Progress & Recovery',
    desc: 'Every launch step is saved as it runs. Close the page, lose connection, or hit a failed transaction, and the launch page shows the interrupted attempt along with the step it stopped at.',
    tip: 'Resume continues with the same issuer, so you never pay the 2 XLM issuer reserve twice. Only Discard starts over and forfeits it.',
  },
  {
    icon: Globe,
    title: 'Custom Domain & stellar.toml',
    desc: 'Leave the domain field empty to host your token metadata here, or enter your own domain to publish .well-known/stellar.toml there — the launch hands you the exact file to copy.',
    tip: 'A custom toml lets wallets and explorers pull your logo and description from your own domain.',
  },
  {
    icon: ShieldCheck,
    title: 'Costs to Expect',
    desc: 'A non-refundable 2 XLM issuer reserve, roughly 0.00001 XLM per operation in network fees, and refundable reserves for offers, trustlines and pools.',
    tip: 'The review screen totals everything up front, and each trade shows its own fee and reserve estimate before you sign.',
  },
  {
    icon: UserRound,
    title: 'Profiles & Avatars',
    desc: 'Set a display name, bio and avatar from your profile page — they replace your wallet address in the social feed and on the leaderboard.',
    tip: 'Open a profile by tapping any wallet address in the feed.',
  },
  {
    icon: MessageCircle,
    title: 'Social Feed',
    desc: 'Share trades and thoughts with the community: post text or an image, attach a token, and like or comment on other people\u2019s posts.',
    tip: 'Use the Social tab in the bottom nav. Your connected wallet address is your identity on every post.',
  },
  {
    icon: Share2,
    title: 'Sharing Tokens & Trades',
    desc: 'Share any token from its page, or share a trade right after it fills. On phones this opens your device\u2019s own share sheet — Messages, WhatsApp, X, and everything else installed.',
    tip: 'Every token gets its own auto-generated preview card that goes out with the share. Where a share sheet is not available, the message and link are copied to your clipboard instead.',
  },
  {
    icon: UserPlus,
    title: 'New Holders Today',
    desc: 'This home-page section lists wallets that bought any tracked token in the last 24 hours, pulled live from on-chain trades.',
    tip: 'A quick way to see which tokens are gaining new attention right now.',
  },
  {
    icon: Trophy,
    title: 'Top Earners Leaderboard',
    desc: 'Ranks wallets by return % on the XLM they actually spent, across every token in the app. Positive returns are green, losses are red.',
    tip: 'Your own row is highlighted and your rank shows even outside the top 50. Wallets that only seeded liquidity are not ranked.',
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
    <div className="min-h-screen bg-[#0a0b0d] text-white max-w-lg mx-auto pb-[calc(5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-[#0a0b0d]/95 backdrop-blur border-b border-white/5 pt-[env(safe-area-inset-top)]">
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
    </div>
  );
}