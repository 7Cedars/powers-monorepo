'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { usePowersStore, useStatusStore } from '@/context/store'
import { usePowers } from '@/hooks/usePowers'
import { parseChainId } from '@/utils/parsers'
import { CommunicationChannels } from '@/context/types'
import { ArrowPathIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import { useErrorStore } from '@/context/store'
import { ActionsList } from '@/components/forum/ActionsList'
import { OrgMetadata } from '@/components/forum/OrgMetadata'
import { OrgRoles } from '@/components/forum/OrgRoles'
import { OrgTreasury } from '@/components/forum/OrgTreasury'
import { MandateSelectModal } from '@/components/forum/MandateSelectModal'
import { Mandate } from '@/context/types'

type Tab = 'actions' | 'organisation' | 'roles' | 'treasury'

const TABS: { id: Tab; label: string }[] = [
  { id: 'actions',      label: 'Actions' },
  { id: 'roles',        label: 'Roles' },
  { id: 'treasury',     label: 'Treasury' },
  { id: 'organisation', label: 'Organisation' },
]

export default function OverviewPage() {
  const powers = usePowersStore()
  const statusPowers = useStatusStore()
  const { fetchPowers } = usePowers()
  const { powers: powersAddress, chainId } = useParams<{ powers: `0x${string}`; chainId: string }>()
  const router = useRouter()
  const [fetchAttempted, setFetchAttempted] = useState(false)
  const error = useErrorStore(state => state.error)

  const [activeTab, setActiveTab] = useState<Tab>('actions')
  const [mandateModalOpen, setMandateModalOpen] = useState(false)

  useEffect(() => {
    if (powers.contractAddress == undefined || powers.contractAddress == '0x0' || powers.contractAddress != powersAddress) {
      fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId))
    }
  }, [powersAddress, chainId])

  const handleFetchPowers = async () => {
    if (powersAddress && chainId) {
      setFetchAttempted(true)
      await fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId))
    }
  }

  const handleMandateSelected = (mandate: Mandate) => {
    router.push(`/forum/${chainId}/${powersAddress}/new?mandateId=${mandate.index.toString()}`)
  }

  if (!powers.name) {
    return (
      <div className="flex-1 flex flex-col bg-background scanlines font-mono items-center justify-center p-4">
        <div className="max-w-md w-full border border-border bg-background">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <span className="text-muted-foreground uppercase tracking-wider text-sm">FETCH POWERS</span>
          </div>
          <div className="p-6 flex flex-col items-center gap-4">
            {!fetchAttempted || statusPowers.status === 'pending' ? (
              <>
                <p className="text-muted-foreground text-center text-sm">
                  Powers has not been loaded yet. If it does not load automatically within one minute, click below to fetch the instance and enter the organisation.
                </p>
                <button
                  onClick={handleFetchPowers}
                  disabled={statusPowers.status === 'pending'}
                  className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <ArrowPathIcon className={`w-4 h-4 ${statusPowers.status === 'pending' ? 'animate-spin' : ''}`} />
                  <span className="text-sm uppercase tracking-wider">
                    {statusPowers.status === 'pending' ? 'FETCHING...' : 'ENTER POWERS'}
                  </span>
                </button>
              </>
            ) : (
              <p className="text-muted-foreground text-center text-sm">
                No Powers organisation found at this address and chain. Please check the URL or add this organisation to your saved list.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full overflow-y-auto px-2 sm:px-4 py-4 gap-4 min-h-0">
      <div className="flex-1 flex flex-col border border-border">
        {/* Banner */}
        <div
          className="h-32 relative overflow-hidden flex-shrink-0"
          style={{
            backgroundImage: powers?.metadatas?.banner ? `url(${powers.metadatas.banner})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-background/20" />
        </div>

        {/* Description */}
        <div className="px-6 py-3 bg-muted/50 border-b border-border">
          <p className="font-mono text-xs text-foreground leading-relaxed whitespace-pre-wrap">
            {powers?.metadatas?.description || 'No description available.'}
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex bg-muted/50 border-b border-border overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-xs font-mono uppercase tracking-wider whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Overview — external link */}
          <a
            href={`/overview/${chainId}/${powersAddress}/organisation`}
            className="ml-auto flex items-center gap-1.5 px-5 py-2.5 text-xs font-mono uppercase tracking-wider whitespace-nowrap text-muted-foreground hover:text-primary transition-colors border-b-2 border-transparent -mb-px"
            title="Go to overview page"
          >
            Overview
            <ArrowTopRightOnSquareIcon className="w-3 h-3 shrink-0" />
          </a>
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'actions' && (
            <ActionsList onNewAction={() => setMandateModalOpen(true)} />
          )}

          {activeTab === 'organisation' && (
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
          )}

          {activeTab === 'roles' && (
            <OrgRoles powers={powers} />
          )}

          {activeTab === 'treasury' && (
            <OrgTreasury treasuryAddress={powers?.treasury} />
          )}
        </div>
      </div>

      {/* Mandate select modal */}
      <MandateSelectModal
        open={mandateModalOpen}
        onOpenChange={setMandateModalOpen}
        onSelect={handleMandateSelected}
      />
    </main>
  )
}
