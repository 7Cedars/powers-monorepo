'use client'

import React, { useState, useEffect } from "react";
import { useParams, usePathname } from 'next/navigation';
import { setStatus, setError, setAction, useActionStore, usePowersStore, useSavedProtocolsStore } from "@/context/store";
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { AllFlows } from './AllFlows'; 
import { useConnection, usePublicClient, useSwitchChain } from "wagmi";
import { usePowers } from "@/hooks/usePowers";
import { parseChainId } from "@/utils/parsers"; 

interface EditorLayoutProps {
  children: React.ReactNode;
}

const SidePanel = ({ children }: { children: React.ReactNode }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
 
  return (
    <div 
      className="fixed top-0 left-0 h-screen flex flex-row transition-all duration-300 ease-in-out z-5"
      style={{
        width: isCollapsed ? '36px' : 'min(670px, 100vw)',
      }}
      help-nav-item="left-panel"
    >
      {/* Collapse/Expand Button - appears on the left edge of the panel */}
      {/* <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="h-full flex-shrink-0 bg-slate-100 border-l border-slate-300 transition-all duration-200 flex items-center justify-center hover:bg-slate-200"
        style={{
          width: '36px',
          minWidth: '36px',
          flexShrink: 0,
        }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <div className={`transform transition-transform duration-300 text-slate-600 ${
            isCollapsed ? 'rotate-180' : 'rotate-0'
          }`}>
            <ChevronRightIcon className="w-6 h-6" />
          </div>
        </div>
      </button> */}

      {/* Panel Content */}
      <div 
        className={`flex flex-col transition-opacity duration-200 bg-slate-100 overflow-hidden ${
          isCollapsed 
            ? 'opacity-0 delay-0' 
            : 'opacity-100 delay-200'
        }`}
        style={{
          width: isCollapsed ? '0px' : 'calc(min(670px, 100vw) - 36px)',
          height: '100vh'
        }}  
      > 
        <div className="w-full h-full overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function EditorLayout({ children }: EditorLayoutProps) {
  const pathname = usePathname(); 
  const { fetchPowers } = usePowers();
  const publicClient = usePublicClient();
  const switchChain = useSwitchChain();
  const { chain } = useConnection();
  const action = useActionStore();
  const powers = usePowersStore();
  const { savedProtocols, loadSavedProtocols, addProtocol } = useSavedProtocolsStore();
  const { powers: powersAddress, chainId } = useParams<{ chainId: string, powers: string }>();
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);

    // Load powers instance if not loaded yet
  useEffect(() => {
    if (powersAddress && chainId) {
      if (powers.contractAddress == undefined || powers.contractAddress == `0x0` || powers.contractAddress != powersAddress) {
        fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId));
      }
    }
  }, [powersAddress, chainId, fetchPowers])

  console.log('@EditorLayout rendered:', {powersAddress, chainId, action, powers})

  // reset status, error, and action when pathname changes
  useEffect(() => {
    setError({error: null})
    setStatus({status: "idle"})
  }, [pathname, action])

  return (  
    <div className="min-h-screen bg-slate-100 relative">
      {/* Background PowersFlow - fills entire screen as ground layer */}
      <div 
        className="fixed top-0 left-0 w-full h-full bg-slate-100 z-0" 
        style={{ boxShadow: 'inset 8px 0 16px -8px rgba(0, 0, 0, 0.1)' }}
      >
        { chainId && powersAddress &&
          <AllFlows 
          key={`powers-flow`} 
        />
        }
      </div>
      
      {/* Side Panel - positioned on the left */}
      <SidePanel>
        {children}
      </SidePanel>
    </div>
  )
}