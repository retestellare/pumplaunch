import { Home as HomeIcon, Wallet, MessageCircle, Rocket } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const ITEMS = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/social', label: 'Social', icon: MessageCircle },
  { path: '/launch', label: 'Launch', icon: Rocket },
  { path: '/portfolio', label: 'Wallet', icon: Wallet },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#0a0b0d] border-t border-white/10 max-w-lg mx-auto select-none pb-[env(safe-area-inset-bottom)]">
      <div className="flex">
        {ITEMS.map(({ path, label, icon: Icon }) => {
          // The NFT collection screen lives under the Launch tab, and an asset's
          // own screen under Wallet.
          const active =
            pathname === path ||
            (path === '/launch' && pathname === '/launch-nft') ||
            (path === '/portfolio' && pathname.startsWith('/asset/'));
          return (
            <Link
              key={path}
              to={path}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition select-none ${
                active ? 'text-[#00ff88]' : 'text-white/40'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}