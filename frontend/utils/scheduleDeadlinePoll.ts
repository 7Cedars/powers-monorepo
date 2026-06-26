import { getBlockNumber } from 'wagmi/actions'
import { wagmiConfig } from '@/context/wagmiConfig'
import { getConstants } from '@/context/constants'
import { ChainId } from '@/context/types'

// Start the polling burst slightly before the estimated deadline, since the
// estimate (based on a fixed BLOCKS_PER_HOUR assumption) can run fast or slow.
const SAFETY_MARGIN_MS = 10_000

/**
 * Schedules a one-off block read to estimate when `targetBlock` will be reached,
 * then runs `checkFn` every `intervalMs` starting near that estimate until it
 * resolves `true`. Avoids continuous block-number watching: no RPC traffic while
 * the deadline is far off, a short burst of cheap reads only around the estimate.
 *
 * Returns a cancel function to stop any pending timeout/polling.
 */
export function scheduleDeadlinePoll(
  targetBlock: bigint,
  chainId: ChainId,
  checkFn: () => Promise<boolean>,
  intervalMs = 5000
): () => void {
  let cancelled = false
  let pollId: ReturnType<typeof setInterval> | undefined
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const startPolling = () => {
    if (cancelled || pollId) return
    const poll = async () => {
      if (cancelled) return
      const done = await checkFn().catch(() => false)
      if (done && pollId) {
        clearInterval(pollId)
        pollId = undefined
      }
    }
    void poll()
    pollId = setInterval(poll, intervalMs)
  }

  const schedule = async () => {
    try {
      const currentBlock = await getBlockNumber(wagmiConfig, { chainId })
      if (cancelled) return

      if (currentBlock >= targetBlock) {
        startPolling()
        return
      }

      const constants = getConstants(chainId)
      const secondsUntil = (Number(targetBlock - currentBlock) / constants.BLOCKS_PER_HOUR) * 3600
      const msUntil = Math.max(0, secondsUntil * 1000 - SAFETY_MARGIN_MS)
      timeoutId = setTimeout(startPolling, msUntil)
    } catch {
      if (!cancelled) timeoutId = setTimeout(schedule, intervalMs)
    }
  }

  void schedule()

  return () => {
    cancelled = true
    if (timeoutId) clearTimeout(timeoutId)
    if (pollId) clearInterval(pollId)
  }
}
