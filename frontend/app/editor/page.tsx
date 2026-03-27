'use client'

import React, { useState, useEffect } from 'react'
import { Powers } from '@/context/types'
import { OrgSummaryBox } from '@/components/OrgSummaryBox'
import { AlertDialog } from '@/components/AlertDialog' 
import { useSavedProtocolsStore } from '@/context/store'
import { usePowers } from '@/hooks/usePowers'
import { Footer } from '@/components/Footer'

export default function ProtocolPage() {
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

  return (
    <div className="min-h-full min-w-full flex flex-col bg-background scanlines">
      <main className="flex-1 max-w-4/5 mx-auto bg-background w-full px-4 py-8">
        <h1 className="font-mono text-foreground tracking-wider mb-2 text-center uppercase text-lg">
          SAVED ORGANISATIONS
        </h1>
        <p className="font-mono text-xs text-muted-foreground text-center mb-6">
          Here is an overview of all Powers Protocols saved in your browser.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedProtocols.map((protocol) => (
            <OrgSummaryBox
              key={protocol.contractAddress}
              powers={protocol}
              onArchive={() => handleArchiveDao(protocol.contractAddress)}
              alignment="column"
              showHeader={true}
            />
          ))}
        </div>

        <AlertDialog
          open={!!archiveTarget}
          onOpenChange={(open) => !open && setArchiveTarget(null)}
          title="ARCHIVE PROTOCOL"
          description={`Are you sure you want to archive this protocol? To add it again, you will need to visit /forum/${archiveTarget?.chainId || '[CHAINID]'}/${archiveTarget?.contractAddress || '[ADDRESS]'}.`}
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
  )
}
