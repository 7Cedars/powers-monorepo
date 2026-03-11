import React, { createContext, useContext, useState, ReactNode } from 'react';

interface WalletContextType {
  isConnected: boolean;
  isAnonymous: boolean;
  walletAddress: string | null;
  ensName: string | null;
  connect: (address: string, ens?: string) => void;
  disconnect: () => void;
  enterAnonymous: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

// Mock wallet addresses for simulation
export const MOCK_WALLET = {
  address: '0xe5805f00A7610A9005afb45CA6a00df90Ae2b101',
  ens: 'participant.eth',
};

export function WalletProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [ensName, setEnsName] = useState<string | null>(null);

  const connect = (address: string, ens?: string) => {
    setWalletAddress(address);
    setEnsName(ens || null);
    setIsConnected(true);
    setIsAnonymous(false);
  };

  const disconnect = () => {
    setWalletAddress(null);
    setEnsName(null);
    setIsConnected(false);
    setIsAnonymous(false);
  };

  const enterAnonymous = () => {
    setIsAnonymous(true);
    setIsConnected(false);
    setWalletAddress(null);
    setEnsName(null);
  };

  return (
    <WalletContext.Provider
      value={{
        isConnected,
        isAnonymous,
        walletAddress,
        ensName,
        connect,
        disconnect,
        enterAnonymous,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
