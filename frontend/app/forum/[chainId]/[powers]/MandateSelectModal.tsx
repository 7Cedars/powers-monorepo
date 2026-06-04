'use client'

import { useMemo } from 'react'
import { useReadContracts } from 'wagmi'
import { useParams } from 'next/navigation'
import { ForumModal } from '@/components/ForumModal'
import { powersAbi } from '@/context/abi'
import { usePowersStore } from '@/context/store'
import { Mandate } from '@/context/types'
import { useEffectiveAddress } from '@/hooks/useEffectiveAddress'
import { bigintToRole } from '@/utils/bigintTo'

const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')

interface MandateSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (mandate: Mandate) => void
}

export function MandateSelectModal({ open, onOpenChange, onSelect }: MandateSelectModalProps) {
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>()
  const powers = usePowersStore()
  const userAddress = useEffectiveAddress()

  const activeMandates = useMemo(
    () => (powers.mandates ?? []).filter(m => m.active),
    [powers.mandates]
  )

  const roleIdsToCheck = useMemo(
    () => activeMandates.map(m => m.conditions?.allowedRole ?? 0n),
    [activeMandates]
  )

  const { data: roleResults } = useReadContracts({
    contracts: roleIdsToCheck.map(roleId => ({
      address: powersAddress as `0x${string}`,
      abi: powersAbi,
      functionName: 'hasRoleSince' as const,
      args: [userAddress as `0x${string}`, roleId] as const,
      chainId: Number(chainId),
    })),
    query: { enabled: !!userAddress && roleIdsToCheck.length > 0 },
  })

  const accessibleMandates = useMemo(() => {
    return activeMandates.filter((mandate, idx) => {
      const allowedRole = mandate.conditions?.allowedRole
      if (allowedRole === undefined) return false
      if (allowedRole === PUBLIC_ROLE) return true
      const result = roleResults?.[idx]
      return result?.status === 'success' && (result.result as bigint) > 0n
    })
  }, [activeMandates, roleResults])

  return (
    <ForumModal open={open} onOpenChange={onOpenChange} className="font-mono max-w-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm text-foreground uppercase tracking-wider">Select Mandate</h3>
        <p className="text-xs text-muted-foreground">Actions you can initiate</p>
      </div>

      {!userAddress ? (
        <p className="text-xs text-muted-foreground py-4">Connect wallet to see accessible mandates</p>
      ) : accessibleMandates.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4">No mandates found for your roles</p>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {accessibleMandates.map(mandate => {
            const name = mandate.nameDescription?.split(':')[0] ?? `Mandate #${mandate.index}`
            const description = mandate.nameDescription?.split(':').slice(1).join(':').trim()
            const roleName = bigintToRole(mandate.conditions?.allowedRole ?? 0n, powers)

            return (
              <button
                key={mandate.index.toString()}
                onClick={() => { onSelect(mandate); onOpenChange(false) }}
                className="w-full text-left px-4 py-3 border border-border hover:bg-muted/50 hover:border-primary/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-foreground font-mono truncate">
                      #{mandate.index.toString()} {name}
                    </p>
                    {description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{description}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                    {roleName}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </ForumModal>
  )
}
