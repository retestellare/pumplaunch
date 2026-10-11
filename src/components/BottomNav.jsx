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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#080B0A] border-t border-[#00F59B]/25 max-w-lg mx-auto select-none pb-[env(safe-area-inset-bottom)]">
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
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-extrabold tracking-[.06em] uppercase transition-colors duration-200 select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00F59B] ${
                active
                  ? 'text-[#00F59B] [text-shadow:0_0_10px_rgba(0,245,155,.6)]'
                  : 'text-[#F2F7F4]/40 hover:text-[#F2F7F4]'
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}