import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { StellarWalletsKit, ensureKitInit } from './walletKit';
import { toast } from '@/components/ui/use-toast';

const WalletContext = createContext(null);

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    ensureKitInit();
    StellarWalletsKit.getAddress()
      .then(({ address }) => {
        if (address) setWallet({ address });
      })
      .catch(() => {});
  }, []);

  const connect = useCallback(async () => {
    ensureKitInit();
    setConnecting(true);
    try {
      const { address } = await StellarWalletsKit.authModal();
      setWallet({ address });
    } catch (err) {
      // Cancelling or a wallet that cannot finish connecting must say so
      // instead of leaving the button stuck on "Connecting…".
      if (err?.code !== -1) {
        toast({
          title: 'Wallet connection failed',
          description: err?.message || 'Try again, or pick another wallet.',
          variant: 'destructive',
        });
      }
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await StellarWalletsKit.disconnect();
    } catch {
      /* ignore */
    }
    setWallet(null);
  }, []);

  return (
    <WalletContext.Provider value={{ wallet, connect, disconnect, connecting }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}