// ok, what does this need to do?

import { Status } from "@/context/types"
import { useCallback, useState } from "react"
import { GetBlockReturnType } from "wagmi/actions";
import { wagmiConfig } from "@/context/wagmiConfig"
import { getBlock } from "wagmi/actions";
import { parseChainId } from "@/utils/parsers";

import { toEurTimeFormat } from "@/utils/toDates";
import { toFullDateFormat } from "@/utils/toDates";

// On Arbitrum chains, block.number in Solidity returns the L1 block number (not the L2 block number).
// So we must query the L1 parent chain to get the correct timestamp for a stored block number.
export const L2_TO_L1_CHAIN_MAP: Record<number, number> = {
  421614: 11155111, // Arbitrum Sepolia → Sepolia
  42161:  1,        // Arbitrum One → Ethereum mainnet
}

type BlockTimestamp = {
  chainId: string
  blockNumber: bigint
  timestamp: bigint
}

// Helper functions for bigint serialization
const bigintReplacer = (key: string, value: any) =>
  typeof value === "bigint" ? value.toString() : value

const bigintReviver = (key: string, value: any) => {
  // More robust bigint conversion with validation
  if (typeof value === "string" && /^\d+$/.test(value)) {
    if (key === "blockNumber" || key === "timestamp") {
      try {
        return BigInt(value)
      } catch (error) {
        console.warn(`@useBlocks, failed to convert ${key} to BigInt:`, value)
        return value
      }
    }
  }
  return value
}

// Helper function to safely load timestamps from localStorage
const loadTimestampsFromStorage = (): Map<string, BlockTimestamp> => {
  if (typeof window === 'undefined') return new Map()
  try {
    const localStore = localStorage.getItem("blockTimestamps")
    // console.log("@useBlocks, raw localStorage data: ", localStore)
    
    if (!localStore) {
      return new Map()
    }
    
    const parsed = JSON.parse(localStore, bigintReviver)
    // console.log("@useBlocks, parsed data: ", parsed)
    
    // Ensure parsed data is an array of key-value pairs
    if (!Array.isArray(parsed)) {
      // console.warn("@useBlocks, localStorage data is not an array, clearing...")
      localStorage.removeItem("blockTimestamps")
      return new Map()
    }
    
    // Validate each entry before creating the Map
    const validEntries = parsed.filter((entry): entry is [string, BlockTimestamp] => {
      if (!Array.isArray(entry) || entry.length !== 2) {
        return false
      }
      
      const [key, value] = entry
      if (typeof key !== "string" || !value) {
        return false
      }
      
      // Validate BlockTimestamp structure
      if (typeof value.chainId !== "string" || 
          typeof value.blockNumber !== "bigint" || 
          typeof value.timestamp !== "bigint") {
        return false
      }
      
      // Validate timestamp is reasonable (not 0 or negative)
      if (value.timestamp <= 0n) {
        return false
      }
      
      return true
    })
    
    return new Map(validEntries)
  } catch (error) {
    // console.error("@useBlocks, error loading from localStorage: ", error)
    localStorage.removeItem("blockTimestamps") // Clear corrupted data
    return new Map()
  }
}

export const useBlocks = () => {
  const [status, setStatus ] = useState<Status>("idle")
  const [error, setError] = useState<any | null>(null)
  const [timestamps, setTimestamps] = useState<Map<string, BlockTimestamp>>(() => loadTimestampsFromStorage())
  
  const fetchTimestamps = useCallback(
    async (blockNumbers: bigint[], chainId: string) => {
      // console.log("@useBlocks, fetching timestamp: ", blockNumbers, chainId)
      setStatus("pending")
      setError(null)

      const saved = loadTimestampsFromStorage()
      // console.log("@useBlocks, loaded saved: ", saved)

      for (const blockNumber of blockNumbers) {
        const cacheKey = `${chainId}:${blockNumber}`
        if (saved.size == 0 || saved.get(cacheKey) == undefined) {
          try {
            const contractChainId = parseChainId(chainId)
            const lookupChainId = (L2_TO_L1_CHAIN_MAP[contractChainId] ?? contractChainId) as typeof contractChainId
            const block = await getBlock(wagmiConfig, {
              blockNumber: BigInt(blockNumber),
              chainId: lookupChainId
            })
            const blockParsed = block as GetBlockReturnType
            
            // Validate the timestamp from the blockchain
            if (!blockParsed.timestamp || blockParsed.timestamp <= 0n) {
              console.warn(`@useBlocks, invalid timestamp for block ${blockNumber}:`, blockParsed.timestamp)
              continue // Skip this block but don't fail the entire operation
            }
            
            const blockTimestamp: BlockTimestamp = {
              chainId, 
              blockNumber: BigInt(blockNumber), 
              timestamp: blockParsed.timestamp
            }
            
            saved.set(cacheKey, blockTimestamp)

            // Re-read the latest storage right before writing - a concurrent
            // fetchTimestamps() call (e.g. Timeline.tsx fires one effect for
            // proposed/requested/fulfilled and a separate one for vote-end/
            // delay-end) can write its own entries between this call's start
            // and now. Writing through `saved` (this call's stale snapshot)
            // would silently drop those entries.
            const latest = loadTimestampsFromStorage()
            latest.set(cacheKey, blockTimestamp)
            try {
              localStorage.setItem("blockTimestamps", JSON.stringify(Array.from(latest.entries()), bigintReplacer))
            } catch (storageError) {
              console.error("@useBlocks, error saving to localStorage: ", storageError)
              // Continue execution even if localStorage fails
            }
          } catch (error) {
            console.error(`@useBlocks, error fetching block ${blockNumber}: `, error)
            setStatus("error")
            setError(error as Error)
            return
          }
        }
      }
      // Apply this call's results directly rather than via a status-change
      // effect - concurrent fetchTimestamps calls (e.g. Timeline.tsx firing
      // once before and once after blockNumber resolves) share this hook's
      // `status` state, so a later call's setStatus("success") can be a
      // no-op if status is already "success", silently dropping its results.
      setTimestamps(loadTimestampsFromStorage())
      setStatus("success")
    },
    []
  )

  return { status, error, timestamps, fetchTimestamps }
}