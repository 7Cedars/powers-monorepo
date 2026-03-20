'use client'

import { useState } from 'react';
import { DaoSummaryBox } from '@/components/DaoSummaryBox'; 
import { AlertDialog } from '@/components/AlertDialog';
import { Powers } from '@/context/types';
import { useSavedProtocolsStore } from '@/context/store';

export default function AllDaos() {
  const { savedProtocols, removeProtocol } = useSavedProtocolsStore();
  const [archiveTarget, setArchiveTarget] = useState<Powers | null>(null);

  const handleArchiveDao = (contractAddress: `0x${string}`) => {
    try {
      removeProtocol(contractAddress);
      console.log('DAO archived successfully')
    } catch (error) {
      console.error('Error archiving DAO:', error)
    }
  }

  // const displayName = ensName || (walletAddress ? parseAddress(walletAddress) : ''); // Needs to be implemented through asap. 

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
                onArchive={() => setArchiveTarget(protocol)}
                alignment = "column"
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
    </div>
    );

}