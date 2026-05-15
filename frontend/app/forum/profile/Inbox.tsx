'use client'

import { useEffect, useMemo, useState } from 'react'
import { useReadContracts } from 'wagmi'
import { useRouter } from 'next/navigation'
import { InboxIcon } from '@heroicons/react/24/outline'
import { useSavedProtocolsStore, setPowers, setAction } from '@/context/store'
import { powersAbi } from '@/context/abi'
import { Powers, Action, Mandate } from '@/context/types'
import { useBlocks } from '@/hooks/useBlocks'
import { toFullDateFormat } from '@/utils/toDates'

const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
const PAGE_SIZE = 25

interface InboxProps {
  userAddress?: `0x${string}`
}

type RoleEntry = {
  protocol: Powers
  roleId: bigint
}

type InboxItem = {
  protocol: Powers
  mandate: Mandate
  action: Action
  event: 'proposed' | 'requested' | 'fulfilled' | 'cancelled'
  blockNumber: bigint
}

const EVENT_DISPLAY: Record<InboxItem['event'], { label: string; color: string }> = {
  proposed:  { label: 'Proposed',  color: 'text-blue-500'   },
  requested: { label: 'Requested', color: 'text-yellow-500' },
  fulfilled: { label: 'Fulfilled', color: 'text-green-600'  },
  cancelled: { label: 'Cancelled', color: 'text-orange-500' },
}

export function Inbox({ userAddress }: InboxProps) {
  const router = useRouter()
  const { savedProtocols } = useSavedProtocolsStore()
  const { timestamps, fetchTimestamps } = useBlocks()
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  // Flatten all (protocol, roleId) pairs across saved protocols for batch hasRoleSince
  const roleEntries = useMemo<RoleEntry[]>(() => {
    if (!userAddress) return []
    const entries: RoleEntry[] = []
    for (const protocol of savedProtocols) {
      for (const role of protocol.roles ?? []) {
        if (role.roleId === PUBLIC_ROLE) continue
        entries.push({ protocol, roleId: role.roleId })
      }
    }
    return entries
  }, [userAddress, savedProtocols])

  const { data: roleResults, isLoading } = useReadContracts({
    contracts: roleEntries.map(({ protocol, roleId }) => ({
      address: protocol.contractAddress,
      abi: powersAbi,
      functionName: 'hasRoleSince' as const,
      args: [userAddress!, roleId] as const,
      chainId: Number(protocol.chainId),
    })),
    query: {
      enabled: !!userAddress && roleEntries.length > 0,
      staleTime: 0,
    },
  })

  // Map: contractAddress → Set of roleId strings the user holds
  const userRolesByProtocol = useMemo(() => {
    const map = new Map<string, Set<string>>()
    if (!roleResults) return map
    roleResults.forEach((result, i) => {
      if (result.status !== 'success' || !result.result) return
      const { protocol, roleId } = roleEntries[i]
      const key = protocol.contractAddress
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(roleId.toString())
    })
    return map
  }, [roleResults, roleEntries])

  const allItems = useMemo<InboxItem[]>(() => {
    const items: InboxItem[] = []
    const seen = new Set<string>()

    const addItem = (
      protocol: Powers,
      mandate: Mandate,
      action: Action,
      event: InboxItem['event'],
      blockNumber: bigint
    ) => {
      const key = `${protocol.contractAddress}:${action.actionId}:${event}`
      if (seen.has(key)) return
      seen.add(key)
      items.push({ protocol, mandate, action, event, blockNumber })
    }

    for (const protocol of savedProtocols) {
      const heldRoles = userRolesByProtocol.get(protocol.contractAddress) ?? new Set<string>()
      const mandates = protocol.mandates ?? []

      const canAccessMandate = (mandate: Mandate): boolean => {
        const allowed = mandate.conditions?.allowedRole
        if (allowed === undefined) return false
        if (allowed === PUBLIC_ROLE) return true
        return heldRoles.has(allowed.toString())
      }

      // Flow-accessible mandate IDs: all mandates in flows where the user
      // can access at least one mandate directly
      const flowAccessibleIds = new Set<string>()
      for (const flow of protocol.flows ?? []) {
        const flowMandates = mandates.filter(m =>
          flow.mandateIds.some(id => id.toString() === m.index.toString())
        )
        if (flowMandates.some(m => canAccessMandate(m))) {
          for (const m of flowMandates) flowAccessibleIds.add(m.index.toString())
        }
      }

      for (const mandate of mandates) {
        const directAccess = canAccessMandate(mandate)
        const flowAccess = flowAccessibleIds.has(mandate.index.toString())

        if (!directAccess && !flowAccess) continue

        for (const action of mandate.actions ?? []) {
          if (directAccess) {
            // Pool A: all state transitions for directly-accessible mandates
            if (action.proposedAt)  addItem(protocol, mandate, action, 'proposed',  action.proposedAt)
            if (action.requestedAt) addItem(protocol, mandate, action, 'requested', action.requestedAt)
            if (action.fulfilledAt) addItem(protocol, mandate, action, 'fulfilled', action.fulfilledAt)
            if (action.cancelledAt) addItem(protocol, mandate, action, 'cancelled', action.cancelledAt)
          } else {
            // Pool B: only fulfilledAt events for flow-accessible mandates the user can't act on
            if (action.fulfilledAt) addItem(protocol, mandate, action, 'fulfilled', action.fulfilledAt)
          }
        }
      }
    }

    items.sort((a, b) => (a.blockNumber > b.blockNumber ? -1 : a.blockNumber < b.blockNumber ? 1 : 0))
    return items
  }, [savedProtocols, userRolesByProtocol])

  const visibleItems = useMemo(() => allItems.slice(0, visibleCount), [allItems, visibleCount])

  // Fetch block timestamps for all visible items, grouped by chain
  useEffect(() => {
    if (visibleItems.length === 0) return
    const byChain = new Map<string, bigint[]>()
    for (const item of visibleItems) {
      const chainId = String(item.protocol.chainId)
      if (!byChain.has(chainId)) byChain.set(chainId, [])
      byChain.get(chainId)!.push(item.blockNumber)
    }
    for (const [chainId, blockNumbers] of byChain) {
      fetchTimestamps(blockNumbers, chainId)
    }
  }, [visibleItems, fetchTimestamps])

  const handleItemClick = (item: InboxItem) => {
    // Pre-load the protocol and action into the global store so the action
    // page renders immediately without redirecting to the org overview first.
    setPowers(item.protocol)
    setAction(item.action)
    router.push(`/forum/${Number(item.protocol.chainId)}/${item.protocol.contractAddress}/action/${item.action.actionId}`)
  }

  return (
    <div className="border border-border space-y-3">
      <h4 className="font-mono text-foreground flex items-center gap-2 uppercase tracking-wider text-sm px-4 py-3 border-b border-border bg-muted/50">
        <InboxIcon className="h-4 w-4" /> Inbox
      </h4>
      <div className="p-4">
        {!userAddress ? (
          <p className="font-mono text-xs text-muted-foreground">No wallet connected</p>
        ) : isLoading ? (
          <p className="font-mono text-xs text-muted-foreground">···</p>
        ) : allItems.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">No activity found in saved organisations</p>
        ) : (
          <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1">
              {visibleItems.map((item) => {
                const ts = timestamps.get(`${String(item.protocol.chainId)}:${item.blockNumber}`)
                const { label, color } = EVENT_DISPLAY[item.event]
                const orgName = item.protocol.name
                  ?? `${item.protocol.contractAddress.slice(0, 6)}…${item.protocol.contractAddress.slice(-4)}`
                const mandateName = item.mandate.nameDescription?.split(':')[0]
                  ?? `Mandate #${item.mandate.index}`

                return (
                  <div
                    key={`${item.protocol.contractAddress}:${item.action.actionId}:${item.event}`}
                    onClick={() => handleItemClick(item)}
                    className="font-mono text-xs border border-border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Left: org name + mandate name */}
                      <div className="shrink-0 flex flex-col gap-0.5 w-28 overflow-hidden">
                        <span className="text-foreground truncate">{orgName}</span>
                        <span className="text-muted-foreground truncate">{mandateName}</span>
                      </div>
                      {/* Middle: action description */}
                      <div className="flex-1 min-w-0 flex items-center h-full">
                        <span className="text-muted-foreground truncate block">
                          {item.action.description || '—'}
                        </span>
                      </div>
                      {/* Right: state + date */}
                      <div className="shrink-0 flex flex-col gap-0.5 w-20 text-right">
                        <span className={color}>{label}</span>
                        <span className="text-muted-foreground">
                          {ts ? toFullDateFormat(Number(ts.timestamp)) : '···'}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            {visibleCount < allItems.length && (
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="w-full font-mono text-xs text-muted-foreground hover:text-foreground border border-border px-3 py-2 transition-colors hover:bg-muted/50"
              >
                load more ({allItems.length - visibleCount} remaining)
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
