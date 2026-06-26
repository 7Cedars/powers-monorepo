'use client'

import { useEffect, useRef } from 'react'
import { scheduleDeadlinePoll } from '@/utils/scheduleDeadlinePoll'
import { ChainId } from '@/context/types'

/**
 * React wrapper around scheduleDeadlinePoll for a single target block,
 * e.g. timelock readiness. For multi-action scanning (e.g. vote-state sync
 * over a whole store), call scheduleDeadlinePoll directly instead.
 */
export function useScheduledDeadlinePoll(
  targetBlock: bigint | undefined,
  chainId: ChainId | undefined,
  checkFn: () => Promise<boolean>,
  intervalMs = 5000
) {
  const checkFnRef = useRef(checkFn)
  checkFnRef.current = checkFn

  useEffect(() => {
    if (!targetBlock || !chainId) return
    const cancel = scheduleDeadlinePoll(targetBlock, chainId, () => checkFnRef.current(), intervalMs)
    return cancel
  }, [targetBlock, chainId, intervalMs])
}
