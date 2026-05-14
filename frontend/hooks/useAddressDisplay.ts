import { useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'

/**
 * Custom hook to display an address with ENS resolution
 * 
 * @param address - Ethereum address to display
 * @returns Object containing the display name and loading state
 * 
 * @example
 * ```tsx
 * const { displayName, isLoading } = useAddressDisplay(address)
 * return <span>{displayName}</span>
 * ```
 */
export const useAddressDisplay = (address?: string | undefined) => {
  const { data: ensName, isLoading, isError } = useEnsName({
    address: address ? address as `0x${string}` : "0x0000000000000000000000000000000000000000" as `0x${string}`,
    chainId: mainnet.id,
    query: {
      enabled: !!address && address.length >= 10, // Only fetch if address is valid
      staleTime: 1000 * 60 * 5, // Cache for 5 minutes
      retry: false, // Don't retry on CORS errors
    }
  })

  const getDisplayName = (): string => {
    // Return ENS name if available
    if (ensName) return ensName
    
    // Return 'Unknown' for invalid addresses
    if (!address) return 'Unknown'
    if (address.length < 10) return address
    
    // Return abbreviated address as fallback (including when ENS lookup fails)
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return {
    displayName: getDisplayName(),
    ensName,
    isLoading,
    isError,
  }
}
