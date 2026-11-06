import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { StellarWalletsKit, ensureKitInit } from './walletKit';

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

  // A wallet picker the user closes, or a module that answers with its own error
  // payload instead of an Error, must not escape as an unhandled rejection: the
  // app simply stays disconnected and the button is ready to tap again.
  const connect = useCallback(async () => {
    ensureKitInit();
    setConnecting(true);
    try {
      const { address } = await StellarWalletsKit.authModal();
      if (address) setWallet({ address });
    } catch {
      /* dismissed or unavailable — nothing to report */
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