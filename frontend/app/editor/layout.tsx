'use client'

import React from "react";
import { useState, useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { usePowersStore, useStatusStore, setStatus, setError, useSavedProtocolsStore, setAction, useActionStore } from "@/context/store";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useConnection, usePublicClient, useSwitchChain } from "wagmi";
import { usePowers } from "@/hooks/usePowers";
import { parseChainId } from "@/utils/parsers";
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAddressDisplay } from "@/hooks/useAddressDisplay";
import { BlockCounter } from "@/components/BlockCounter";
import { ArrowRightStartOnRectangleIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { ChevronRightIcon } from "@heroicons/react/24/solid";

interface EditorLayoutProps {
  children: React.ReactNode;
}

export default function EditorLayout({ children }: EditorLayoutProps) {
    const router = useRouter(); 
    const pathname = usePathname();
    const powers = usePowersStore();
    const statusPowers = useStatusStore();
    const { savedProtocols, loadSavedProtocols, addProtocol } = useSavedProtocolsStore();
    const { wallets, ready: walletsReady } = useWallets();
    const {ready, authenticated, login, logout, connectWallet} = usePrivy();
    const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
    const { powers: powersAddress, chainId } = useParams<{ chainId: string, powers: string }>();
    const { fetchPowers } = usePowers();
    const publicClient = usePublicClient();
    const switchChain = useSwitchChain();
    const { chain } = useConnection();
    const action = useActionStore();
    const { displayName, isLoading } = useAddressDisplay(wallets[0]?.address);

    const isEditorPage = pathname === '/editor';

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

    const fetchBlockNumber = async () => {
      if (!publicClient) return;
      try {
        const number = await publicClient.getBlockNumber();
        setBlockNumber(number);
      } catch (error) {
        console.error('Failed to fetch block number:', error);
      }
    };

    useEffect(() => {
        fetchBlockNumber();
    }, [ publicClient ])

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
    <div className="h-screen min-w-screen flex-1 flex flex-col bg-background scanlines min-h-0">
      {/* Warning screen for small devices */}
      <div className="lg:hidden h-screen flex flex-col items-center justify-center p-6 bg-background">
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
              The Editor is designed for larger screens to provide the best experience when building and managing governance protocols.
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

      {/* Main editor content - hidden on small screens */}
      <div className="hidden lg:flex lg:flex-col lg:h-full lg:min-h-0 bg-background">
      <header className="z-25 border-b border-border px-3 sm:px-4 py-4 bg-background">
        <div className="w-full flex flex-wrap items-center justify-between gap-2 sm:gap-3 bg-background">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/editor" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">
              {powers.name ? powers.name : "EDITOR"} 
            </a>
            {!isEditorPage && powersAddress && chainId &&
              <BlockCounter onRefresh={() => {
                fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId));
                fetchBlockNumber();
              }} blockNumber={blockNumber} />
            }
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {ready && authenticated && walletsReady && wallets[0] &&
            <>
                <button
                onClick={() => router.push('/profile')}
                className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors">
                  {isLoading ? 'Loading...' : displayName}
                </button>
                <button
                onClick={ logout }
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                
                  <ArrowRightStartOnRectangleIcon className="h-3 w-3" />
                  <span className="hidden sm:inline">DISCONNECT</span>
                </button>
                <span className="text-muted-foreground">|</span>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <CheckCircleIcon className="h-2 w-2 fill-primary text-primary" />
                  <span className="text-foreground">CONNECTED</span>
                </div>
              </>
            }
            {ready && !authenticated &&
            <button
              onClick={ login }
              className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-all duration-200">
              
                <CheckCircleIcon className="h-2 w-2 fill-muted-foreground text-muted-foreground" />
                <span className="text-muted-foreground">NOT CONNECTED</span>
              </button>
            }
            {ready && authenticated && walletsReady && !wallets[0] &&
            <button
              onClick={ connectWallet }
              className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-all duration-200">
              
                <CheckCircleIcon className="h-2 w-2 fill-muted-foreground text-muted-foreground" />
                <span className="text-muted-foreground">NOT CONNECTED</span>
              </button>
            }
            <ThemeToggle />
          </div>
        </div>
      </header>
      
      {children}
            
      
      </div>
    </div> 
    )
}
