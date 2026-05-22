'use client'

import { useState, useEffect, useMemo } from 'react'
import { useSavedProtocolsStore } from '@/context/store'
import { wagmiConfig } from '@/context/wagmiConfig'
import { powersAbi } from '@/context/abi'
import { getPublicClient, getBlockNumber } from 'wagmi/actions'
import { ChainId } from '@/context/types'

const VOTE_CACHE_KEY = 'powersProfileVoteCache'
const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_BLOCK_RANGE = 50000n

type VoteCacheEntry = { count: number; cachedAt: number }
type VoteCache = Record<string, VoteCacheEntry>

export function useProfileStats(userAddress?: `0x${string}`) {
  const { savedProtocols } = useSavedProtocolsStore()
  const [votes, setVotes] = useState(0)
  const [isLoadingVotes, setIsLoadingVotes] = useState(false)

  const { proposals, executions } = useMemo(() => {
    if (!userAddress) return { proposals: 0, executions: 0 }

    let proposals = 0
    let executions = 0
    const addr = userAddress.toLowerCase()

    for (const protocol of savedProtocols) {
      for (const mandate of protocol.mandates ?? []) {
        for (const action of mandate.actions ?? []) {
          if (action.caller?.toLowerCase() !== addr) continue
          if (action.proposedAt != null) proposals++
          if (action.fulfilledAt != null) executions++
        }
      }
    }

    return { proposals, executions }
  }, [userAddress, savedProtocols])

  useEffect(() => {
    if (!userAddress || savedProtocols.length === 0) return

    async function fetchVotes() {
      setIsLoadingVotes(true)

      const raw = localStorage.getItem(VOTE_CACHE_KEY)
      const cache: VoteCache = raw ? JSON.parse(raw) : {}
      const now = Date.now()

      type Result = { count: number; cacheKey: string; entry: VoteCacheEntry | null }

      const results = await Promise.all(
        savedProtocols.map(async (protocol): Promise<Result> => {
          const cacheKey = `${protocol.contractAddress}_${String(protocol.chainId)}`
          const cached = cache[cacheKey]

          if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
            return { count: cached.count, cacheKey, entry: null }
          }

          try {
            const chainId = Number(protocol.chainId) as ChainId
            const client = getPublicClient(wagmiConfig, { chainId })
            if (!client) return { count: cached?.count ?? 0, cacheKey, entry: null }

            const currentBlock = await getBlockNumber(wagmiConfig, { chainId })
            const minFromBlock = currentBlock > MAX_BLOCK_RANGE ? currentBlock - MAX_BLOCK_RANGE : 0n
            const fromBlock =
              protocol.foundedAt && protocol.foundedAt > minFromBlock
                ? protocol.foundedAt
                : minFromBlock

            const logs = await client.getContractEvents({
              address: protocol.contractAddress,
              abi: powersAbi,
              eventName: 'VoteCast',
              args: { account: userAddress },
              fromBlock,
              toBlock: currentBlock,
            })

            const entry: VoteCacheEntry = { count: logs.length, cachedAt: now }
            return { count: logs.length, cacheKey, entry }
          } catch {
            return { count: cached?.count ?? 0, cacheKey, entry: null }
          }
        })
      )

      const total = results.reduce((sum, r) => sum + r.count, 0)

      const updatedCache = { ...cache }
      for (const r of results) {
        if (r.entry) updatedCache[r.cacheKey] = r.entry
      }
      localStorage.setItem(VOTE_CACHE_KEY, JSON.stringify(updatedCache))

      setVotes(total)
      setIsLoadingVotes(false)
    }

    fetchVotes()
  }, [userAddress, savedProtocols])

  return { proposals, executions, votes, isLoadingVotes }
}
