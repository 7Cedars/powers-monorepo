'use client'

import React from "react";
import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { usePowersStore, setStatus, setError,  } from "@/context/store";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { NavigationDropdownMenu } from './NavigationDropdownMenu';
import { ThemeToggle } from '@/components/ThemeToggle';
import { truncateAddress } from '@/utils/addressUtils';
import { defaultPowers101 } from '@/context/defaultProtocols'
import { ChevronRightIcon } from "@heroicons/react/24/solid";

import { ArrowRightStartOnRectangleIcon, CheckCircleIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import { Powers } from "@/context/types";
import { usePowers } from "@/hooks/usePowers";
import { useConnection, usePublicClient, useSwitchChain } from "wagmi";
import { BlockCounter } from "@/components/BlockCounter";

export default function ForumLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    const router = useRouter(); 
    const pathname = usePathname();
    const powers = usePowersStore(); 
    const { wallets, ready: walletsReady } = useWallets();
    const {ready, authenticated, login, logout, connectWallet} = usePrivy();
    const [savedProtocols, setSavedProtocols] = useState<Powers[]>([])
    const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
    const { powers: powersAddress } = useParams<{ chainId: string, powers: string }>()
    const { chainId } = useParams<{ chainId: string }>()
    const { fetchPowers } = usePowers();
    const publicClient = usePublicClient();
    const switchChain = useSwitchChain();
    const { chain } = useConnection(); 

    const triggerName =
      pathname.includes('/profile') ? "Profile" : 
      pathname.includes('/allDaos') ? "All DAOs" : 
      !chainId ? "Navigation" :
      "Main"

    useEffect(() => {
        const fetchBlockNumber = async () => {
          if (powers)  
          try {
            const number = await publicClient?.getBlockNumber() ?? null;
            setBlockNumber(number as bigint);
          } catch (error) {
            console.error('Failed to fetch block number:', error);
            return null;
          }
        }
        fetchBlockNumber();
    }, [publicClient, powers])
    

    // Load powers instance if not loaded yet. 
    // Switch chain when selected chain changes
    useEffect(() => {
      if (chainId && chain?.id !== Number(chainId)) {
        switchChain.mutate({ chainId: Number(chainId) });
      }
    }, [chainId, chain?.id, switchChain]);
  
    // useEffect(() => {
    //   if (powers.contractAddress == undefined || powers.contractAddress == `0x0` || powers.contractAddress != powersAddress) {
    //       fetchPowers(powersAddress as `0x${string}`)
    //   }
    // }, [ powersAddress ])
  
    // reset status and error when pathname changes
    useEffect(() => {
      setError({error: null})
      setStatus({status: "idle"})
    }, [pathname])

  return (  
    <div className="h-screen min-w-screen flex-1 flex flex-col bg-background scanlines min-h-0">
      <header className="border-b border-border px-3 sm:px-4 py-4 bg-background">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/forum" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">{
                powers.name ? powers.name : "FORUM"
            } 
            </a>
              { 
                <BlockCounter onRefresh={() => {
                  fetchPowers(powersAddress as `0x${string}`);
                }} blockNumber={blockNumber} />
              }
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {ready && authenticated && walletsReady && wallets[0] &&
            <>
                <button
                onClick={() => router.push('/profile')}
                className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors">
                
                  {truncateAddress(wallets[0].address)}
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

      <div className="border-b border-border px-4 py-1.5 bg-muted/5">
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

      {children}

    </div> 
    )
}
