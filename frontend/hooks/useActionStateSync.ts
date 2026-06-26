'use client'

import { useEffect } from 'react'
import { readContracts } from 'wagmi/actions'
import { wagmiConfig } from '@/context/wagmiConfig'
import { powersAbi } from '@/context/abi'
import { usePowersStore, setPowers } from '@/context/store'
import { scheduleDeadlinePoll } from '@/utils/scheduleDeadlinePoll'
import { ChainId } from '@/context/types'

// Proposed (0) and Active (3) are the only states that can still silently
// resolve to Succeeded/Defeated purely from block.number passing, with no
// contract event to react to (see Powers.sol getActionState()).
const PENDING_STATES = new Set([0, 3])

/**
 * Reconciles `action.state` for Proposed/Active actions once their vote
 * period has actually ended, since that transition emits no contract event
 * and would otherwise stay stale in the store until a full page reload.
 * Schedules a one-off block read per action near its estimated vote-end,
 * then a short getActionState() polling burst until resolved - no
 * continuous block-number watching.
 */
export const useActionStateSync = (
  powersAddress: `0x${string}` | undefined,
  chainId: ChainId | undefined
) => {
  useEffect(() => {
    if (!powersAddress || !chainId || powersAddress === '0x0') return
    const active = new Map<string, () => void>()

    const scan = () => {
      const current = usePowersStore.getState()
      for (const mandate of current.mandates ?? []) {
        for (const action of mandate.actions ?? []) {
          if (action.state === undefined || !PENDING_STATES.has(action.state)) continue
          if (!action.voteEnd) continue
          if (active.has(action.actionId)) continue

          const actionId = action.actionId
          const actionIdBig = BigInt(actionId)

          const checkFn = async (): Promise<boolean> => {
            const [state] = await readContracts(wagmiConfig, {
              allowFailure: false,
              contracts: [{
                abi: powersAbi,
                address: powersAddress,
                functionName: 'getActionState',
                args: [actionIdBig],
                chainId
              }]
            }) as [number]

            if (PENDING_STATES.has(state)) return false

            const latest = usePowersStore.getState()
            const updatedMandates = latest.mandates?.map(m => ({
              ...m,
              actions: m.actions?.map(a =>
                a.actionId === actionId ? { ...a, state } : a
              )
            }))
            setPowers({ mandates: updatedMandates })
            active.delete(actionId)
            return true
          }

          active.set(actionId, scheduleDeadlinePoll(action.voteEnd, chainId, checkFn))
        }
      }
    }

    scan()
    const unsubscribe = usePowersStore.subscribe(scan)

    return () => {
      unsubscribe()
      active.forEach(cancel => cancel())
      active.clear()
    }
  }, [powersAddress, chainId])
}
