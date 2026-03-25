'use client'

import { useState, useEffect } from 'react';
import { OrgSummaryBox } from '@/components/OrgSummaryBox'; 
import { AlertDialog } from '@/components/AlertDialog';
import { Powers } from '@/context/types';
import { useSavedProtocolsStore } from '@/context/store';
import { usePowers } from '@/hooks/usePowers';
import { Footer } from '../Footer';

export default function AllDaos() {
  const { savedProtocols, removeProtocol, loadSavedProtocols } = useSavedProtocolsStore();
  const { fetchPowers } = usePowers();
  const [ archiveTarget, setArchiveTarget ] = useState<Powers | null>(null);

  // Load saved protocols and fetch chain data on mount
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

  const handleArchiveDao = (contractAddress: `0x${string}`) => {
    try {
      removeProtocol(contractAddress);
      setArchiveTarget(null);
      console.log('DAO archived successfully')
    } catch (error) {
      console.error('Error archiving DAO:', error)
    }
  }

  // const displayName = ensName || (walletAddress ? parseAddress(walletAddress) : ''); // Needs to be implemented through asap.

  return (
    <div className="min-h-screen flex flex-col scanlines"> 
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <h1 className="font-mono text-foreground tracking-wider mb-2 text-center uppercase text-lg">All organisations</h1>
        <p className="font-mono text-xs text-muted-foreground text-center mb-6">Here is an overview of all organisations saved in your browser.</p>

        {/* DAO Summary Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {
            savedProtocols.map((protocol) => (
              <OrgSummaryBox
                key={protocol.contractAddress}
                powers={protocol}
                onArchive={() => setArchiveTarget(protocol)}
                alignment="column"
                showHeader={true}
              />
            ))
          }
        </div>

        <AlertDialog
          open={!!archiveTarget}
          onOpenChange={(open) => !open && setArchiveTarget(null)}
          title="ARCHIVE DAO"
          description={`Are you sure you want to archive this DAO? To add it again, you will need to visit https://powers-protocol.vercel.app/${archiveTarget?.chainId || '[CHAINID]'}/${archiveTarget?.contractAddress || '[ADDRESS]'}.`}
          cancelText="Go back"
          confirmText="Confirm"
          onConfirm={() => {
            if (archiveTarget) {
              handleArchiveDao(archiveTarget.contractAddress);
            }
          }}
        />

      </main>
      
      <Footer />

    </div>
    );

}