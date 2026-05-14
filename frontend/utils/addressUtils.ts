/**
 * Synchronous utility function to parse an address with optional ENS name
 * 
 * @param address - Ethereum address to display
 * @param ensName - Optional ENS name (if already resolved)
 * @returns Formatted address string
 * 
 * @example
 * ```ts
 * // With ENS name
 * parseAddress('0x1234...', 'vitalik.eth') // returns 'vitalik.eth'
 * 
 * // Without ENS name
 * parseAddress('0x1234567890abcdef') // returns '0x1234...cdef'
 * ```
 * 
 * Note: For automatic ENS resolution in React components, use the `useAddressDisplay` hook instead
 */
export const parseAddress = (
  address: string | undefined, 
  ensName?: string | null
): string => {
  if (ensName) return ensName
  if (!address) return 'Unknown'
  if (address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}
