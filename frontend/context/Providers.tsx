'use client';

import React, { useState, useEffect } from "react";
import { PrivyClientConfig, PrivyProvider } from '@privy-io/react-auth';
import { arbitrumSepolia, baseSepolia, foundry, optimismSepolia, sepolia, zksyncSepoliaTestnet } from '@wagmi/core/chains'
import { wagmiConfig } from './wagmiConfig'  
import { WagmiProvider } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTheme } from 'next-themes';

const queryClient = new QueryClient()

const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';

export function Providers({children}: {children: React.ReactNode}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const privyConfig: PrivyClientConfig = {
    defaultChain: arbitrumSepolia,
    supportedChains: [
      zksyncSepoliaTestnet,
      optimismSepolia,
      baseSepolia,
      sepolia,
      arbitrumSepolia,
      ...(isLocalhost ? [foundry] : [])
    ],
    loginMethods: ['wallet'],
    appearance: {
        theme: (mounted ? resolvedTheme : 'light') as 'light' | 'dark',
        accentColor: '#676FFF',
        logo: '/logo1_notext.png', 
        walletList: ["metamask", "rainbow", "detected_wallets", "wallet_connect"]
    }
  };

  return (  
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID as string}
        // clientId={process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID as string} 
        config={privyConfig} 
        >
          <QueryClientProvider client={queryClient}>
            <WagmiProvider config={wagmiConfig}>
                {children}
            </WagmiProvider>
          </QueryClientProvider>
      </PrivyProvider> 
  );
}
