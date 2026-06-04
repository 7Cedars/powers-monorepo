'use client'

import { useChains } from 'wagmi'
import { useParams } from 'next/navigation'
import { parseChainId } from '@/utils/parsers'
import { AssetList } from '@/app/overview/[chainId]/[powers]/treasury/AssetList'

interface OrgTreasuryProps {
  treasuryAddress?: `0x${string}`
}

const ZERO = '0x0000000000000000000000000000000000000000'

export function OrgTreasury({ treasuryAddress }: OrgTreasuryProps) {
  const { chainId } = useParams<{ chainId: string }>()
  const chains = useChains()
  const supportedChain = chains.find(c => c.id === parseChainId(chainId))
  const blockExplorerUrl = supportedChain?.blockExplorers?.default.url

  const hasTreasury = !!treasuryAddress && treasuryAddress !== '0x0' && treasuryAddress !== ZERO

  if (!hasTreasury) {
    return <p className="text-xs text-muted-foreground font-mono py-4">No treasury configured</p>
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Treasury Address</p>
        {blockExplorerUrl ? (
          <a
            href={`${blockExplorerUrl}/address/${treasuryAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-foreground hover:text-primary hover:underline break-all"
          >
            {treasuryAddress}
          </a>
        ) : (
          <p className="text-xs font-mono text-foreground break-all">{treasuryAddress}</p>
        )}
      </div>
      <AssetList />
    </div>
  )
}
