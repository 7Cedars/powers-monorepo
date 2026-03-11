'use client'

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { usePowersStore } from "@/context/store";
import { usePrivy, useWallets } from "@privy-io/react-auth";

import { DaoSummaryBox } from '@/app/forum/_components/DaoSummaryBox'; 
import { defaultPowers101 } from '@/context/defaultProtocols'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
'@/app/forum/_components/ui/alert-dialog';
import { useChains } from 'wagmi';
import { Powers } from '@/context/types';

export default function AllDaos() {
  const pathname = usePathname();
  const powers = usePowersStore(); 
  const [savedProtocols, setSavedProtocols] = useState<Powers[]>([])
    
  const [archiveTarget, setArchiveTarget] = useState<`0x${string}` | null>(null);


  useEffect(() => {
    const loadSavedProtocols = () => {
      try {
        const localStore = localStorage.getItem('powersProtocols')
        let protocols: Powers[] = []
        
        if (localStore && localStore !== 'undefined') {
          protocols = JSON.parse(localStore)
        }

        // Check if Powers 101 already exists
        const powers101Exists = protocols.some(p => p.name === 'Powers 101')
        
        if (!powers101Exists) {
          // Add Powers 101 to the list
          protocols.unshift(defaultPowers101) 
        }

        setSavedProtocols(protocols)
      } catch (error) {
        console.error('Error loading saved protocols:', error)
        setSavedProtocols([defaultPowers101])
      }
    }

    loadSavedProtocols()
  }, [])

  // const displayName = ensName || (walletAddress ? truncateAddress(walletAddress) : ''); // Needs to be implemented through asap. 

  return (
    <div className="min-h-full min-w-full flex flex-col bg-background scanlines"> 

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <h1 className="font-mono text-foreground tracking-wider mb-2 text-center uppercase text-lg">ALL DAOs</h1>
        <p className="font-mono text-xs text-muted-foreground text-center mb-6">Here is an  overview of all DAOs saved in your browser.</p>

        {/* DAO Summary Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {
            savedProtocols.map((protocol) => (
              <DaoSummaryBox
                key={protocol.contractAddress}
                powers={protocol}
                onArchive={() => setArchiveTarget(protocol.contractAddress)}
              />
            ))
          }
        </div>

        {/* <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
          <AlertDialogContent className="font-mono">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono text-sm tracking-wider">ARCHIVE DAO</AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-xs leading-relaxed">
                Are you sure you want to archive this DAO? To add it again, you will need to visit [ADDRESS].
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono text-xs">Go back</AlertDialogCancel>
              <AlertDialogAction
                className="font-mono text-xs"
                onClick={() => {
                  if (archiveTarget) {
                    setHiddenDaos((prev) => [...prev, archiveTarget]);
                  }
                  setArchiveTarget(null);
                }}>
                
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog> */}

      </main>
    </div>
    );

}