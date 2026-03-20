'use client'

import React, { useState, useEffect } from 'react'
import { Powers } from '@/context/types'
import { DaoSummaryBox } from '@/components/DaoSummaryBox'
import { AlertDialog } from '@/components/AlertDialog'
import { defaultPowers101 } from '@/context/defaultProtocols'

export default function ProtocolPage() {
  const [savedProtocols, setSavedProtocols] = useState<Powers[]>([])
  const [protocolToDelete, setProtocolToDelete] = useState<Powers | null>(null)

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
        // const powerLabsExists = protocols.some(p => p.name === 'Power Labs')
        // const powerLabsChildExists = protocols.some(p => p.name === 'Child Powers')
        
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

  const handleArchive = (contractAddress: string) => {
    const protocol = savedProtocols.find(p => p.contractAddress === contractAddress)
    if (protocol) {
      setProtocolToDelete(protocol)
    }
  }

  const confirmArchive = () => {
    if (!protocolToDelete) return

    const updatedProtocols = savedProtocols.filter(
      p => p.contractAddress !== protocolToDelete.contractAddress
    )

    localStorage.setItem('powersProtocols', JSON.stringify(updatedProtocols, (key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ))

    setSavedProtocols(updatedProtocols)
    setProtocolToDelete(null)
  }

  return (
    <div className="min-h-full min-w-full flex flex-col bg-background scanlines">
      <main className="flex-1 max-w-4/5 mx-auto w-full px-4 py-8">
        <h1 className="font-mono text-foreground tracking-wider mb-2 text-center uppercase text-lg">
          SAVED ORGANISATIONS
        </h1>
        <p className="font-mono text-xs text-muted-foreground text-center mb-6">
          Here is an overview of all Powers Protocols saved in your browser.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {savedProtocols.map((protocol) => (
            <DaoSummaryBox
              key={protocol.contractAddress}
              powers={protocol}
              onArchive={handleArchive}
              alignment="column"
              showHeader={true}
            />
          ))}
        </div>

        <AlertDialog
          open={!!protocolToDelete}
          onOpenChange={(open) => !open && setProtocolToDelete(null)}
          title="ARCHIVE PROTOCOL"
          description={`Are you sure you want to archive this protocol? To add it again, you will need to visit /forum/${protocolToDelete?.chainId || '[CHAINID]'}/${protocolToDelete?.contractAddress || '[ADDRESS]'}.`}
          cancelText="Go back"
          confirmText="Confirm"
          onConfirm={confirmArchive}
        />
      </main>
    </div>
  )
}
