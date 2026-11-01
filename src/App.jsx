import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigationType } from 'react-router-dom';
import { motion } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import BottomNav from '@/components/BottomNav';
import TabStack from '@/components/TabStack';
import { TAB_PATHS } from '@/lib/tabs';
import { WalletProvider } from '@/lib/wallet';
import TokenDetail from '@/pages/TokenDetail';
import WalletAsset from '@/pages/WalletAsset';
import TokenHolders from '@/pages/TokenHolders';
import Guide from '@/pages/Guide';
import Profile from '@/pages/Profile';
import AssetManager from '@/pages/AssetManager';
import ManageAsset from '@/pages/ManageAsset';
import Rewards from '@/pages/Rewards';
import RewardsAdmin from '@/pages/RewardsAdmin';
import RewardTracker from '@/components/RewardTracker';
import ShareSheetHost from '@/components/share/ShareSheetHost';

// Detail pages slide in from the side you travelled from.
const slide = {
  enter: (direction) => ({ opacity: 0, x: direction * 28 }),
  center: { opacity: 1, x: 0 },
};

function AppRoutes() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const direction = navigationType === 'POP' ? -1 : 1;

  return (
    <>
      {/* Tab pages stay mounted, so their state and scroll position survive navigation. */}
      <TabStack />
      {!TAB_PATHS.includes(location.pathname) && (
        <motion.div
          key={location.pathname}
          custom={direction}
          variants={slide}
          initial="enter"
          animate="center"
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <Routes location={location}>
            <Route path="/token/:id" element={<TokenDetail />} />
            <Route path="/token/:id/holders" element={<TokenHolders />} />
            <Route path="/asset/:code/:issuer" element={<WalletAsset />} />
            <Route path="/guide" element={<Guide />} />
            <Route path="/profile/:walletAddress" element={<Profile />} />
            <Route path="/manage" element={<AssetManager />} />
            <Route path="/manage/:kind/:id" element={<ManageAsset />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/rewards-admin" element={<RewardsAdmin />} />
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </motion.div>
      )}
      <BottomNav />
    </>
  );
}

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <WalletProvider>
            {/* Credits an incoming referral link to the inviter's wallet. */}
            <RewardTracker />
            <AppRoutes />
            <ShareSheetHost />
          </WalletProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App 