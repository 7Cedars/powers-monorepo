'use client'

import React from "react";
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { usePowersStore, setStatus, setError, useSavedProtocolsStore, setAction, useActionStore } from "@/context/store";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { NavigationDropdownMenu } from './NavigationDropdownMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { useAddressDisplay } from "@/hooks/useAddressDisplay";

import { ArrowRightStartOnRectangleIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { usePowers } from "@/hooks/usePowers";
import { useConnection, usePublicClient, useSwitchChain } from "wagmi";
import { BlockCounter } from "@/components/BlockCounter";
import { useXmtpClient } from "@/hooks/useXmtpClient";
import { ForumModal } from "@/components/ForumModal";

import { parseChainId } from "@/utils/parsers";

export default function ForumLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const router = useRouter(); 
    const pathname = usePathname();
    const powers = usePowersStore();
    const { savedProtocols, loadSavedProtocols, addProtocol } = useSavedProtocolsStore();
    const { wallets, ready: walletsReady } = useWallets();
    const {ready, authenticated, login, logout, connectWallet} = usePrivy();
    const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
    const { powers: powersAddress } = useParams<{ chainId: string, powers: string }>()
    const { chainId } = useParams<{ chainId: string }>()
    const { fetchPowers } = usePowers();
    const publicClient = usePublicClient();
    const switchChain = useSwitchChain();
    const { chain } = useConnection();
    const action = useActionStore();
    const { displayName, isLoading } = useAddressDisplay(wallets[0]?.address);
    const { client, isConnected: xmtpConnected, initializeClient, disconnect: disconnectXmtp} = useXmtpClient();
    const [showXmtpModal, setShowXmtpModal] = useState(false);

    console.log("layout being triggered")

    const triggerName =
      pathname.includes('/profile') ? "Profile" :  
      !chainId ? "Navigation" :
      "Main"

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
    }, [publicClient, powers])

    // Load powers instance if not loaded yet. 
    // Switch chain when selected chain changes
    useEffect(() => {
      if (chainId && chain?.id !== Number(chainId)) {
        switchChain.mutate({ chainId: Number(chainId) });
      }
    }, [ chain?.id ]);
  
    // reset status and error when pathname changes
    useEffect(() => {
      setError({error: null})
      setStatus({status: "idle"})
      setAction({...action, upToDate: false})
    }, [pathname])

    useEffect(() => {
      loadSavedProtocols()
    }, [loadSavedProtocols])

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
    }, [powers, powers.contractAddress, savedProtocols, addProtocol])
 
  return (  
    <div className="h-screen w-screen flex flex-col bg-background scanlines overflow-hidden">
      <header className="w-full flex flex-col items-center border-b border-border px-3 sm:px-4 py-4 flex-shrink-0">
        <div className="w-full flex flex-wrap md:flex-nowrap items-center justify-center md:justify-between max-w-6xl gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 md:flex-1">
            <a href="/forum" className="font-mono text-base sm:text-lg text-foreground tracking-wider truncate hover:text-foreground/80 transition-colors">{
                powers.name ? powers.name : "FORUM"
            } 
            </a>
              { 
                <BlockCounter onRefresh={() => {
                  if (powersAddress && chainId) {
                    fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId));
                    fetchBlockNumber();
                  }
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
                  {/* <CheckCircleIcon className="h-2 w-2 fill-primary text-primary" /> */}
                  <span className="text-foreground">CONNECTED</span>
                </div>
                <span className="text-muted-foreground">|</span>
                {/* XMTP Status - Three states */}
                {xmtpConnected && client?.inboxId ? (
                  // State 1: Connected to XMTP - clickable to disconnect
                  <button
                    onClick={disconnectXmtp}
                    className="flex items-center gap-2 font-mono text-xs text-foreground hover:text-muted-foreground transition-colors"
                  >
                    <span>XMTP</span>
                  </button>
                ) : client?.inboxId && !xmtpConnected ? (
                  // State 2: Has inbox but not connected
                  <button
                    onClick={initializeClient}
                    className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <span>XMTP</span>
                  </button>
                ) : !client?.inboxId ? (
                  // State 3: No inbox - show in red
                  <button
                    onClick={() => setShowXmtpModal(true)}
                    className="flex items-center gap-2 font-mono text-xs text-red-500 hover:text-red-400 transition-colors"
                  >
                    <span>XMTP</span>
                  </button>
                ) : (
                  // Loading/Unknown state
                  <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <span>XMTP</span>
                  </div>
                )}
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

      <div className="border-b border-border px-4 py-1.5 bg-muted/5 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
      
          { pathname.includes('/action') || pathname.includes('/mandate') || pathname.includes('/flow') ?
              <button 
                onClick={() => router.push(`/forum/${powers.chainId}/${powers.contractAddress}`)} 
                className="flex items-center justify-center gap-2 px-3 py-2 border border-border border-foreground cursor-pointer hover:bg-foreground hover:text-background transition-all text-xs uppercase font-mono leading-none">
                <ArrowLeftIcon className="h-3 w-3" />
                <span className="leading-none">BACK TO DAO</span>
              </button>
              :
              <>
              <div className="w-3 h-3">
                <ChevronRightIcon />
              </div> 
              <NavigationDropdownMenu savedProtocols={savedProtocols} trigger={<span>{triggerName}</span>} />
              </>
          }
        </div>
      </div>
      
      <main className="flex-1 overflow-y-auto min-h-0">
        {children}
      </main>

      {/* XMTP Login Modal */}
      <ForumModal 
        open={showXmtpModal} 
        onOpenChange={setShowXmtpModal}
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-xl font-mono font-bold text-foreground">Login to XMTP</h2>
            <p className="text-sm text-muted-foreground font-mono">
              Please log in to your XMTP identity to send and receive messages on the XMTP network.
            </p>
          </div>
          
          <div className="space-y-3 pt-2">
            <div className="bg-muted/50 p-3 rounded border border-border">
              <p className="text-xs text-muted-foreground font-mono">
                This will require a signature from your wallet to log in to your encrypted XMTP identity.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => setShowXmtpModal(false)}
              className="flex-1 px-4 py-2 border border-border font-mono text-sm hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                await initializeClient();
                setShowXmtpModal(false);
              }}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm hover:bg-primary/90 transition-colors"
            >
              Login
            </button>
          </div>
        </div>
      </ForumModal>

    </div> 
    )
}
