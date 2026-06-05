'use client'

import { useParams } from 'next/navigation'
import { AssetList } from '@/app/overview/[chainId]/[powers]/treasury/AssetList'
import { AddressLink } from '@/components/AddressLink'
import { usePowersStore } from '@/context/store'

interface OrgTreasuryProps {
  treasuryAddress?: `0x${string}`
}

const ZERO = '0x0000000000000000000000000000000000000000'

export function OrgTreasury({ treasuryAddress }: OrgTreasuryProps) {
  const { chainId } = useParams<{ chainId: string }>()
  const paymaster = usePowersStore((state) => state.paymaster)

  const hasTreasury = !!treasuryAddress && treasuryAddress !== '0x0' && treasuryAddress !== ZERO
  const hasPaymaster = !!paymaster && paymaster !== '0x0' && paymaster !== ZERO

  if (!hasTreasury && !hasPaymaster) {
    return <p className="text-xs text-muted-foreground font-mono py-4">No treasury configured</p>
  }

  return (
    <div className="space-y-3">
      {hasTreasury && (
        <>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Treasury Address</p>
            <AddressLink
              address={treasuryAddress}
              chainId={chainId}
              showFull
              className="text-xs font-mono text-foreground hover:text-primary break-all"
            />
          </div>
          {hasPaymaster && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Paymaster Address</p>
              <AddressLink
                address={paymaster}
                chainId={chainId}
                showFull
                className="text-xs font-mono text-foreground hover:text-primary break-all"
              />
            </div>
          )}
          <AssetList />
        </>
      )}
    </div>
  )
}
