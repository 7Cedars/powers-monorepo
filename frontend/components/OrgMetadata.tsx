'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useSignMessage, useReadContract } from 'wagmi'
import { useEffectiveAddress } from '@/hooks/useEffectiveAddress'
import {
  GlobeAltIcon,
  DocumentTextIcon,
  ScaleIcon,
  ChatBubbleLeftRightIcon,
  BookOpenIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CpuChipIcon,
  BuildingOfficeIcon,
} from '@heroicons/react/24/outline'
import {
  DiscordIcon,
  TelegramIcon,
  XIcon,
  ParagraphIcon,
  YoutubeIcon,
  FacebookIcon,
  GithubIcon,
} from '@/components/MetadataLinks'
import { CommunicationChannels, familyMember } from '@/context/types'
import { powersAbi } from '@/context/abi'

interface OrgMetadataProps {
  description?: string
  website?: string
  codeOfConduct?: string
  disputeResolution?: string
  communicationChannels?: CommunicationChannels
  parentContracts?: familyMember[]
  childContracts?: familyMember[]
  chainId?: bigint | number
  powersAddress?: string
  showAdminActions?: boolean
}

function MetaRow({
  icon: Icon,
  label,
  href,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  href?: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-foreground hover:text-primary hover:underline break-all"
          >
            {href}
          </a>
        ) : (
          children
        )}
      </div>
    </div>
  )
}

export function OrgMetadata({
  description,
  website,
  codeOfConduct,
  disputeResolution,
  communicationChannels,
  parentContracts,
  childContracts,
  chainId,
  powersAddress,
  showAdminActions = true,
}: OrgMetadataProps) {
  const params = useParams<{ chainId?: string; powers?: string }>()
  const userAddress = useEffectiveAddress()
  const { signMessageAsync } = useSignMessage()
  const [isRegistering, setIsRegistering] = useState(false)

  const contractAddress = powersAddress ?? params?.powers
  const currentChainId = chainId ?? params?.chainId

  const { data: adminSince } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: powersAbi,
    functionName: 'hasRoleSince',
    args: userAddress ? [userAddress, 0n] : undefined,
    chainId: currentChainId ? Number(currentChainId) : undefined,
    query: { enabled: !!userAddress && !!contractAddress },
  })
  const isAdmin = adminSince ? (adminSince as bigint) > 0n : false

  const handleRegisterAgent = async () => {
    if (!userAddress || !contractAddress || !currentChainId) return
    try {
      setIsRegistering(true)
      const message = `Register Powers ${contractAddress} on chain ${currentChainId}`
      const signature = await signMessageAsync({ account: userAddress, message })
      const rpcUrl = process.env.NEXT_PUBLIC_XMTP_AGENT_RPC_URL
      if (!rpcUrl) throw new Error('XMTP Agent RPC URL not configured in .env')
      const response = await fetch(`${rpcUrl}/api/powers/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: contractAddress,
          chainId: Number(currentChainId),
          signerAddress: userAddress,
          signature,
          message,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to register')
      alert(data.message || 'Successfully registered with XMTP Agent!')
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setIsRegistering(false)
    }
  }

  const isValidLink = (link?: string): link is string => !!link && link.trim() !== ''

  const socials = communicationChannels
    ? [
        { url: communicationChannels.discord,       icon: DiscordIcon,              label: 'Discord' },
        { url: communicationChannels.telegram,      icon: TelegramIcon,             label: 'Telegram' },
        { url: communicationChannels.x,             icon: XIcon,                    label: 'X (Twitter)' },
        { url: communicationChannels.paragraph,     icon: ParagraphIcon,            label: 'Paragraph' },
        { url: communicationChannels.youtube,       icon: YoutubeIcon,              label: 'YouTube' },
        { url: communicationChannels.facebook,      icon: FacebookIcon,             label: 'Facebook' },
        { url: communicationChannels.github,        icon: GithubIcon,               label: 'GitHub' },
        { url: communicationChannels.forum,         icon: ChatBubbleLeftRightIcon,  label: 'Forum' },
        { url: communicationChannels.documentation, icon: BookOpenIcon,             label: 'Documentation' },
      ].filter(s => isValidLink(s.url))
    : []

  const basePath = '/forum'

  return (
    <div className="space-y-0 divide-y divide-border">
      {contractAddress && (
        <MetaRow icon={BuildingOfficeIcon} label="Contract Address">
          <p className="text-xs font-mono text-foreground break-all">{contractAddress}</p>
        </MetaRow>
      )}

      {description && (
        <MetaRow icon={DocumentTextIcon} label="About">
          <p className="text-xs font-mono text-foreground leading-relaxed">{description}</p>
        </MetaRow>
      )}

      {isValidLink(website) && (
        <MetaRow icon={GlobeAltIcon} label="Website" href={website} />
      )}

      {isValidLink(codeOfConduct) && (
        <MetaRow icon={DocumentTextIcon} label="Code of Conduct" href={codeOfConduct} />
      )}

      {isValidLink(disputeResolution) && (
        <MetaRow icon={ScaleIcon} label="Dispute Resolution" href={disputeResolution} />
      )}

      {socials.length > 0 && (
        <div className="py-3 border-b border-border last:border-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Communication Channels</p>
          <div className="space-y-2">
            {socials.map(({ url, icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-foreground hover:text-primary hover:underline break-all"
                  >
                    {url}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(parentContracts?.filter(p => p.address && p.title) || []).length > 0 && (
        <div className="py-3 border-b border-border last:border-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Parent Organisations</p>
          <div className="space-y-2">
            {parentContracts!.filter(p => p.address && p.title).map((parent, i) => (
              <div key={i} className="flex items-center gap-3">
                <ArrowUpIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{parent.title}</p>
                  <a
                    href={`${basePath}/${currentChainId ? Number(currentChainId) : ''}/${parent.address}`}
                    className="text-xs font-mono text-foreground hover:text-primary hover:underline break-all"
                  >
                    {parent.address}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(childContracts?.filter(c => c.address && c.title) || []).length > 0 && (
        <div className="py-3 border-b border-border last:border-0">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Child Organisations</p>
          <div className="space-y-2">
            {childContracts!.filter(c => c.address && c.title).map((child, i) => (
              <div key={i} className="flex items-center gap-3">
                <ArrowDownIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{child.title}</p>
                  <a
                    href={`${basePath}/${currentChainId ? Number(currentChainId) : ''}/${child.address}`}
                    className="text-xs font-mono text-foreground hover:text-primary hover:underline break-all"
                  >
                    {child.address}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showAdminActions && isAdmin && (
        <div className="py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Admin</p>
          <button
            onClick={handleRegisterAgent}
            disabled={isRegistering}
            className="flex items-center gap-2 px-3 py-2 bg-background border border-border hover:bg-muted/50 transition-colors text-foreground text-xs font-mono disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CpuChipIcon className={`w-4 h-4 ${isRegistering ? 'animate-pulse' : ''}`} />
            {isRegistering ? 'Registering...' : 'Register XMTP Agent'}
          </button>
        </div>
      )}

      {!description && !isValidLink(website) && !isValidLink(codeOfConduct) && !isValidLink(disputeResolution) && socials.length === 0 && !(showAdminActions && isAdmin) && (
        <p className="py-6 text-center text-xs text-muted-foreground font-mono">No organisation information available</p>
      )}
    </div>
  )
}
