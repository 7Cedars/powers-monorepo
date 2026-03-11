import { useState, useEffect } from 'react';
import { useRouter, useParams, usePathname } from 'next/navigation';
import { usePowersStore } from "@/context/store";
import { ConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";

import { NavigationDropdownMenu } from '@/app/forum/_components/ui/NavigationDropdownMenu';
import { DaoSummaryBox } from '@/app/forum/_components/DaoSummaryBox';
import { ThemeToggle } from '@/app/forum/_components/ThemeToggle';
import { MandateSheet } from '@/app/forum/_components/MandateSheet';
import { truncateAddress } from '@/utils/addressUtils';
import { defaultPowers101 } from '@/context/defaultProtocols'

import { ArrowRightStartOnRectangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

import { WalletModal } from '@/app/forum/_components/WalletModal';
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
  const router = useRouter();
  const chains = useChains()
  const pathname = usePathname();
  const powers = usePowersStore(); 
  const { wallets, ready: walletsReady } = useWallets();
  const {ready, authenticated, login, logout, connectWallet} = usePrivy();
  const [savedProtocols, setSavedProtocols] = useState<Powers[]>([])
    
  const [archiveTarget, setArchiveTarget] = useState<`0x${string}` | null>(null);

  const triggerName = pathname.includes('/profile') ? "Profile" : 
                      pathname.includes('/allDaos') ? "All DAOs" : 
                      powers.name ? powers.name : 
                      "Navigation"; 

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
    <div className="min-h-screen flex flex-col bg-background scanlines">
      <header className="border-b border-border px-3 sm:px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/dao-info" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">[DAO NAME]</a>
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
            {!ready || !authenticated || !walletsReady || !wallets[0] &&
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

      <div className="border-b border-border px-4 py-2 bg-muted/5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <NavigationDropdownMenu savedProtocols={savedProtocols} trigger={<span>{triggerName}</span>} />
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <h1 className="font-mono text-foreground tracking-wider mb-2 text-center uppercase text-lg">ALL DAOs</h1>
        <p className="font-mono text-xs text-muted-foreground text-center mb-6">Here is a live overview of all DAOs in the [DAO NAME] ecosystem.</p>

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