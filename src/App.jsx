import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import { WalletProvider } from '@/lib/wallet';
import Home from '@/pages/Home';
import TokenDetail from '@/pages/TokenDetail';
import Portfolio from '@/pages/Portfolio';
import Social from '@/pages/Social';
import LaunchToken from '@/pages/LaunchToken';

function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <WalletProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/token/:id" element={<TokenDetail />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="/social" element={<Social />} />
              <Route path="/launch" element={<LaunchToken />} />
              <Route path="*" element={<PageNotFound />} />
            </Routes>
          </WalletProvider>
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App