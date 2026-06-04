'use client'

import React from "react";
import { useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { usePowersStore, useStatusStore, setStatus, setError, useSavedProtocolsStore, setAction, useActionStore } from "@/context/store";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useConnection, useSwitchChain } from "wagmi";
import { usePowers } from "@/hooks/usePowers";
import { usePowersLive } from "@/hooks/usePowersLive";
import { parseChainId } from "@/utils/parsers";
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAddressDisplay } from "@/hooks/useAddressDisplay";
import { ArrowRightStartOnRectangleIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { ChevronRightIcon } from "@heroicons/react/24/solid";

interface OverviewLayoutProps {
  children: React.ReactNode;
}

export default function OverviewLayout({ children }: OverviewLayoutProps) {
    const router = useRouter(); 
    const pathname = usePathname();
    const powers = usePowersStore();
    const statusPowers = useStatusStore();
    const { savedProtocols, loadSavedProtocols, addProtocol } = useSavedProtocolsStore();
    const { wallets, ready: walletsReady } = useWallets();
    const {ready, authenticated, login, logout, connectWallet} = usePrivy();
    const { powers: powersAddress, chainId } = useParams<{ chainId: string, powers: string }>();
    const { fetchPowers } = usePowers();
    usePowersLive(
      powersAddress as `0x${string}` | undefined,
      chainId ? parseChainId(chainId) : undefined
    );
    const switchChain = useSwitchChain();
    const { chain } = useConnection();
    const action = useActionStore();
    const { displayName, isLoading } = useAddressDisplay(wallets[0]?.address);

    const isOverviewPage = pathname === '/overview';

    // reset status and error when pathname changes
    useEffect(() => {
      setError({error: null})
      setStatus({status: "idle"})
    }, [pathname])

    useEffect(() => {
      const loadAndFetchData = async () => {
        // First load saved protocols from localStorage
        loadSavedProtocols();
        
        // Get protocols that need data (empty mandates array)
        const protocolsNeedingData = useSavedProtocolsStore.getState().savedProtocols.filter(
          p => !p.mandates || p.mandates.length === 0
        );
        
        // Fetch chain data for each protocol that needs it
        if (protocolsNeedingData.length > 0) {
          await Promise.all(
            protocolsNeedingData.map(protocol => 
              fetchPowers(protocol.contractAddress, Number(protocol.chainId) as any)
            )
          );
          // Reload protocols after fetching to get updated data
          loadSavedProtocols();
        }
      };
      
      loadAndFetchData();
    }, []);

    // Switch chain when selected chain changes
    useEffect(() => {
      if (chainId && chain?.id !== Number(chainId)) {
        switchChain.mutate({ chainId: Number(chainId) });
      }
    }, [chain?.id]);

    // Auto-save current Powers instance if not already saved
    useEffect(() => {
      if (powers && powers.contractAddress && powers.contractAddress !== '0x0' && savedProtocols.length > 0) {
        const isAlreadySaved = savedProtocols.some(
          p => p.contractAddress.toLowerCase() === powers.contractAddress.toLowerCase()
        )
        
        if (!isAlreadySaved) {
          console.log('Auto-saving protocol to localStorage:', powers.contractAddress)
          addProtocol(powers)
        }
      }
    }, [powers.contractAddress, addProtocol])

  return (  
    <div className="h-screen w-screen flex flex-col bg-background scanlines overflow-hidden min-h-0">
      {/* Warning screen for small devices */}
      <div className="lg:hidden h-full flex flex-col items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center space-y-6">
          <div className="space-y-2">
            <h1 className="font-mono text-2xl text-foreground tracking-wider">
              EDITOR
            </h1>
            <p className="text-sm text-muted-foreground">
              Not optimized for small screens
            </p>
          </div>
          
          <div className="space-y-4">
            <p className="text-foreground">
              The Overview is designed for larger screens to provide the best experience when building and managing governance protocols.
            </p>
            <p className="text-muted-foreground text-sm">
              Please visit the Forum to view and interact with existing protocols on mobile devices.
            </p>
          </div>

          <button
            onClick={() => router.push('/forum')}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-mono text-sm hover:bg-primary/90 transition-colors rounded"
          >
            <span>GO TO FORUM</span>
            <ChevronRightIcon className="h-4 w-4" />
          </button>

          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
          >
            <ArrowLeftIcon className="h-3 w-3" />
            <span>BACK TO HOME</span>
          </button>
        </div>
      </div>

      {/* Main overview content - hidden on small screens */}
      <div className="hidden lg:flex lg:flex-col lg:h-full bg-background">
      <header className="z-25 border-b border-border px-3 sm:px-4 py-4 bg-background">
        <div className="w-full flex flex-wrap items-center justify-between gap-2 sm:gap-3 bg-background">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/overview" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">
              {powers.name ? powers.name : "EDITOR"} 
            </a>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>
      
      {children}
            
      
      </div>
    </div> 
    )
}
