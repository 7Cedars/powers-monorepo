'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/Button'
import { useParams, useRouter } from 'next/navigation'
import { parseChainId } from '@/utils/parsers'
import { useChains } from 'wagmi'
import Image from 'next/image'
import { ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { Assets } from './Assets'
import { Roles } from './Roles'
import { Mandates } from './Mandates'
import { Actions } from './Actions'
import { MetadataLinks } from '@/components/MetadataLinks'
import { usePowersStore, useStatusStore } from '@/context/store'
import { CommunicationChannels } from '@/context/types'

export default function FlowPage() {
  const { chainId, powers: addressPowers } = useParams<{ chainId: string, powers: string }>()  
  const router = useRouter() 
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const chains = useChains()
  const supportedChain = chains.find(chain => chain.id == parseChainId(chainId))
  const powers = usePowersStore(); 
  const statusPowers = useStatusStore();
  
  console.log("@home page rendered:", {chains, supportedChain, powers})
  
  return (
    <div className="min-h-full min-w-full flex flex-col bg-background scanlines pt-12">
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        {/* hero banner */}
        <section className="w-full min-h-32 flex flex-col justify-between items-end text-foreground border border-border relative">
          <div className="absolute inset-0 bg-background" />
          
          {/* Banner image (if valid) */}
          {powers?.metadatas?.banner && (
            <div className={`absolute inset-0 transition-opacity duration-500 ${isImageLoaded ? 'opacity-100' : 'opacity-0'}`}>
              <Image
                src={powers.metadatas.banner}
                alt={`${powers.name} banner`}
                fill
                className="object-cover"
                priority
                quality={100}
                onLoadingComplete={() => setIsImageLoaded(true)}
              />
            </div>
          )}
        </section>
        
        {/* Description + link to powers protocol deployment */}
        <div className="border border-border bg-muted/50 mb-6">
          <div className="px-4 py-3">
            <div className="text-foreground text-sm mb-3 font-mono">
              {powers?.metadatas?.description}
            </div>
            
            <a
              href={`${supportedChain?.blockExplorers?.default.url}/address/${addressPowers as `0x${string}`}#code`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="text-xs font-mono break-all">
                {addressPowers as `0x${string}`}
              </span>
              <ArrowUpRightIcon className="w-4 h-4 flex-shrink-0" />
            </a>
          </div>
        </div>
        
        {/* Metadata Links */}
        <div className="mb-6">
          <MetadataLinks 
            website={powers?.metadatas?.website}
            codeOfConduct={powers?.metadatas?.codeOfConduct}
            disputeResolution={powers?.metadatas?.disputeResolution}
            communicationChannels={powers?.metadatas?.communicationChannels as CommunicationChannels}
            parentContracts={powers?.metadatas?.parentContracts}
            childContracts={powers?.metadatas?.childContracts}
            chainId={powers?.chainId}
            isEditorView={true}
          />
        </div>
        
        {/* main body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Assets status={statusPowers.status} powers={powers} />
          <Actions powers={powers} status={statusPowers.status} />
          <Roles powers={powers} status={statusPowers.status} />
          <Mandates powers={powers} status={statusPowers.status} />
        </div>

        {/* Go to forum button */}
        <div className="flex justify-center">
          <Button 
            size={0} 
            showBorder={true} 
            role={6}
            filled={false}
            selected={true}
            onClick={() => router.push(`/forum`)}
            statusButton="idle"
          > 
            <div className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider">
              Go to forum
              <ArrowUpRightIcon className="w-4 h-4" />
            </div>
          </Button>
        </div>
      </main>
    </div>
  )
}
