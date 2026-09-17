import React, { createContext, useContext, useState, useCallback } from 'react';

const WalletContext = createContext(null);
const STORAGE_KEY = 'stellar_pump_wallet';

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const persist = useCallback((data) => {
    setWallet(data);
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const connect = useCallback(() => {
    const r = () => Math.random().toString(36).substring(2, 15).toUpperCase();
    const addr = 'G' + r() + r();
    persist({ address: addr, balance: 10000 });
  }, [persist]);

  const disconnect = useCallback(() => persist(null), [persist]);

  const updateBalance = useCallback((newBalance) => {
    setWallet((prev) => {
      if (!prev) return prev;
      const next = { ...prev, balance: newBalance };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <WalletContext.Provider value={{ wallet, connect, disconnect, updateBalance }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error('useWallet must be used within WalletProvider');
  return ctx;
}