'use client'

import { useParams, useRouter } from 'next/navigation'
import { usePowersStore } from '@/context/store'
import { CommunicationChannels } from '@/context/types'
import { OrgMetadata } from '@/components/forum/OrgMetadata'
import { Button } from '@/components/Button'

export default function OrganisationPage() {
  const powers = usePowersStore()
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>()
  const router = useRouter()

  return (
    <div className="flex flex-col pt-16">
      {/* Banner */}
      <div
        className="h-32 relative overflow-hidden flex-shrink-0"
        style={{
          backgroundImage: powers?.metadatas?.banner ? `url(${powers.metadatas.banner})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: powers?.metadatas?.banner ? undefined : 'hsl(var(--muted))',
        }}
      >
        <div className="absolute inset-0 bg-background/20" />
      </div>

      {/* Org name */}
      {powers?.name && (
        <div className="px-4 py-2 border-b border-border bg-muted/50">
          <p className="font-mono text-xs uppercase tracking-wider text-foreground truncate">{powers.name}</p>
          <p className="font-mono text-[10px] text-muted-foreground truncate">{powers.contractAddress}</p>
        </div>
      )}

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
          xmtpAgentAddress={powers?.metadatas?.xmtpAgentAddress}
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
    </div>
  )
}
