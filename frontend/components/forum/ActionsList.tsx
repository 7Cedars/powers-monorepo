'use client'

import { useEffect, useMemo, useState } from 'react'
import { useReadContracts } from 'wagmi'
import { useRouter, useParams } from 'next/navigation'
import { PlusIcon } from '@heroicons/react/24/outline'
import { usePowersStore, setAction } from '@/context/store'
import { powersAbi } from '@/context/abi'
import { Action, Mandate } from '@/context/types'
import { useBlocks } from '@/hooks/useBlocks'
import { toFullDateFormat, toEurTimeFormat } from '@/utils/toDates'
import { useEffectiveAddress } from '@/hooks/useEffectiveAddress'

const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
const PAGE_SIZE = 25

type ActionItem = {
  mandate: Mandate
  action: Action
  event: 'proposed' | 'requested' | 'fulfilled' | 'cancelled' | 'defeated' | 'succeeded'
  blockNumber: bigint
}

const EVENT_DISPLAY: Record<ActionItem['event'], { label: string; color: string }> = {
  proposed:  { label: 'Proposed',  color: 'text-blue-500'   },
  requested: { label: 'Requested', color: 'text-yellow-500' },
  fulfilled: { label: 'Fulfilled', color: 'text-green-600'  },
  cancelled: { label: 'Cancelled', color: 'text-orange-500' },
  defeated:  { label: 'Defeated',  color: 'text-red-500'    },
  succeeded: { label: 'Succeeded', color: 'text-teal-500'   },
}

interface ActionsListProps {
  onNewAction: () => void
}

export function ActionsList({ onNewAction }: ActionsListProps) {
  const router = useRouter()
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>()
  const powers = usePowersStore()
  const userAddress = useEffectiveAddress()
  const { timestamps, fetchTimestamps } = useBlocks()
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const roleIdsToCheck = useMemo(
    () => powers.roles?.filter(r => r.roleId !== PUBLIC_ROLE).map(r => r.roleId) || [],
    [powers.roles]
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

  const userRoleIds = useMemo(() => {
    const ids = new Set<string>()
    roleResults?.forEach((result, idx) => {
      if (result.status === 'success' && (result.result as bigint) > 0n) {
        ids.add(roleIdsToCheck[idx].toString())
      }
    })
    return ids
  }, [roleResults, roleIdsToCheck])

  const allItems = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = []
    const seen = new Set<string>()
    const mandates = powers.mandates || []

    const addItem = (mandate: Mandate, action: Action, event: ActionItem['event'], blockNumber: bigint) => {
      const key = `${action.actionId}:${event}`
      if (seen.has(key)) return
      seen.add(key)
      items.push({ mandate, action, event, blockNumber })
    }

    const canAccessMandate = (mandate: Mandate): boolean => {
      const allowed = mandate.conditions?.allowedRole
      if (allowed === undefined) return false
      if (allowed === PUBLIC_ROLE) return true
      return !!userAddress && userRoleIds.has(allowed.toString())
    }

    const flowAccessibleIds = new Set<string>()
    for (const flow of powers.flows ?? []) {
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

      for (const action of mandate.actions ?? []) {
        const candidates: { event: ActionItem['event']; blockNumber: bigint }[] = []
        if (directAccess) {
          if (action.proposedAt)  candidates.push({ event: 'proposed',  blockNumber: action.proposedAt })
          if (action.requestedAt) candidates.push({ event: 'requested', blockNumber: action.requestedAt })
          if (action.fulfilledAt) candidates.push({ event: 'fulfilled', blockNumber: action.fulfilledAt })
          if (action.cancelledAt) candidates.push({ event: 'cancelled', blockNumber: action.cancelledAt })
          // Defeated/Succeeded have no on-chain timestamp; derive from action.state
          if (action.state === 4 && !action.cancelledAt && !action.fulfilledAt && !action.requestedAt) {
            candidates.push({ event: 'defeated',  blockNumber: action.voteEnd ?? action.proposedAt ?? 0n })
          }
          if (action.state === 5 && !action.cancelledAt && !action.fulfilledAt && !action.requestedAt) {
            candidates.push({ event: 'succeeded', blockNumber: action.voteEnd ?? action.proposedAt ?? 0n })
          }
        } else if (flowAccess) {
          if (action.fulfilledAt) candidates.push({ event: 'fulfilled', blockNumber: action.fulfilledAt })
        }
        if (candidates.length > 0) {
          const STATE_RANK: Record<ActionItem['event'], number> = { proposed: 1, cancelled: 2, defeated: 4, succeeded: 5, requested: 6, fulfilled: 7 }
          const latest = candidates.reduce((a, b) => STATE_RANK[a.event] >= STATE_RANK[b.event] ? a : b)
          addItem(mandate, action, latest.event, latest.blockNumber)
        }
      }
    }

    const EVENT_ORDER: Record<ActionItem['event'], number> = { proposed: 0, requested: 1, cancelled: 2, defeated: 2, succeeded: 2, fulfilled: 3 }
    items.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) return a.blockNumber > b.blockNumber ? -1 : 1
      return EVENT_ORDER[b.event] - EVENT_ORDER[a.event]
    })
    return items
  }, [powers.mandates, powers.flows, userRoleIds, userAddress])

  const visibleItems = useMemo(() => allItems.slice(0, visibleCount), [allItems, visibleCount])

  useEffect(() => {
    if (visibleItems.length === 0) return
    fetchTimestamps(visibleItems.map(i => i.blockNumber), chainId)
  }, [visibleItems, fetchTimestamps, chainId])

  const handleItemClick = (item: ActionItem) => {
    setAction(item.action)
    router.push(`/forum/${chainId}/${powersAddress}/${item.action.actionId}`)
  }

  return (
    <div className="space-y-3">
      <button
        onClick={onNewAction}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background hover:bg-foreground/80 transition-colors text-xs font-mono uppercase tracking-wider cursor-pointer"
      >
        <PlusIcon className="h-4 w-4" />
        New Action
      </button>

      {!userAddress ? (
        <p className="font-mono text-xs text-muted-foreground px-1">Connect wallet to see your actions</p>
      ) : allItems.length === 0 ? (
        <div className="border border-border">
          <div className="font-mono text-xs px-3 py-2 text-center text-muted-foreground">
            No actions found
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {visibleItems.map(item => {
            const ts = timestamps.get(`${chainId}:${item.blockNumber}`)
            const { label, color } = EVENT_DISPLAY[item.event]
            const mandateName = item.mandate.nameDescription?.split(':')[0] ?? `Mandate #${item.mandate.index}`

            return (
              <div
                key={`${item.action.actionId}:${item.event}`}
                onClick={() => handleItemClick(item)}
                className="font-mono text-xs border border-border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-32 overflow-hidden">
                    <span className="text-foreground truncate block">{mandateName}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground line-clamp-3">{item.action.description || '—'}</span>
                  </div>
                  <div className="shrink-0 flex flex-col gap-0.5 w-40 text-right">
                    <span className={color}>{label}</span>
                    <span className="text-muted-foreground">
                      {ts ? `${toFullDateFormat(Number(ts.timestamp))} ${toEurTimeFormat(Number(ts.timestamp))}` : '···'}
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
  )
}
