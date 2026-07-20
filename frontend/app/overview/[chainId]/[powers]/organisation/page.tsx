'use client'

import { useParams, useRouter } from 'next/navigation'
import { usePowersStore } from '@/context/store'
import { CommunicationChannels } from '@/context/types'
import { OrgMetadata } from '@/components/OrgMetadata'
import { OrgBanner } from '@/components/OrgBanner'
import { Button } from '@/components/Button'

export default function OrganisationPage() {
  const powers = usePowersStore()
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>()
  const router = useRouter()

  return (
    <main className="w-full h-full flex flex-col bg-background">
      <OrgBanner title={powers?.name ?? ''} subtitle={powers?.contractAddress ?? ''} />

      {/* Metadata */}
      <div className="px-4 py-2">
        <OrgMetadata
          description={powers?.metadatas?.description}
          website={powers?.metadatas?.website}
          codeOfConduct={powers?.metadatas?.codeOfConduct}
          disputeResolution={powers?.metadatas?.disputeResolution}
          communicationChannels={powers?.metadatas?.communicationChannels as CommunicationChannels}
          parentContracts={powers?.metadatas?.parentContracts}
          childContracts={powers?.metadatas?.childContracts}
          chainId={powers?.chainId}
          powersAddress={powers?.contractAddress}
          showAdminActions={false}
        />
      </div>

      {/* Forum button */}
      <div className="px-4 py-6">
        <Button
          size={0}
          role={6}
          selected={true}
          filled={false}
          showBorder={true}
          onClick={() => router.push(`/forum/${chainId}/${powersAddress}`)}
        >
          <div className="text-xs px-1">To Forum</div>
        </Button>
      </div>
    </main>
  )
}
