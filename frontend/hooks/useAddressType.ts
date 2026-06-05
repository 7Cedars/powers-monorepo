'use client'

import { useReadContract } from 'wagmi'
import { useSavedProtocolsStore } from '@/context/store'

const MANDATE_COUNTER_ABI = [
  {
    name: 'getMandateCounter',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
] as const

export const useAddressType = (address: string | undefined, chainId: number | undefined) => {
  const { savedProtocols } = useSavedProtocolsStore()

  const savedMatch = address
    ? savedProtocols.find(p => p.contractAddress.toLowerCase() === address.toLowerCase())
    : undefined

  const isKnownPowers = !!savedMatch

  const { data: mandateCounter, isLoading } = useReadContract({
    address: address as `0x${string}`,
    abi: MANDATE_COUNTER_ABI,
    functionName: 'getMandateCounter',
    chainId,
    query: {
      enabled: !isKnownPowers && !!address && !!chainId,
      retry: false,
      staleTime: Infinity,
    },
  })

  const isPowers = isKnownPowers || mandateCounter !== undefined

  return {
    isPowers,
    isLoading: !isKnownPowers && isLoading,
  }
}
