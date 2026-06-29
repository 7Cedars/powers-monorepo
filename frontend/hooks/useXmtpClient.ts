import { useCallback, useEffect, useRef } from 'react'
import { Client, type Signer } from '@xmtp/browser-sdk'
import { IdentifierKind } from '@xmtp/browser-sdk'
import { useWalletClient } from 'wagmi'
import { hexToBytes } from 'viem'
import { useXmtpStore } from '@/context/xmtpStore'
import { usePrivy } from '@privy-io/react-auth'

export function useXmtpClient() {
  const { data: walletClient } = useWalletClient()
  const { authenticated } = usePrivy()

  // Use Zustand store instead of local state
  const client = useXmtpStore((state) => state.client)
  const isLoading = useXmtpStore((state) => state.isLoading)
  const error = useXmtpStore((state) => state.error)
  const isConnected = useXmtpStore((state) => state.isConnected)
  const setClient = useXmtpStore((state) => state.setClient)
  const setIsLoading = useXmtpStore((state) => state.setIsLoading)
  const setError = useXmtpStore((state) => state.setError)
  const setIsConnected = useXmtpStore((state) => state.setIsConnected)
  const resetStore = useXmtpStore((state) => state.reset)

  // Tracks which EOA address the current XMTP session was initialized for.
  // Used to detect wallet switches without relying on isConnected in effect deps.
  const xmtpWalletAddressRef = useRef<string | undefined>(undefined)

  // Keep a ref of isConnected so the address watcher can read it without
  // listing it as a dependency (which would create a cycle via resetStore).
  const isConnectedRef = useRef(isConnected)
  useEffect(() => { isConnectedRef.current = isConnected }, [isConnected])

  // Reset XMTP when the signing EOA changes mid-session (e.g. user switches
  // from AA to a different EOA without a full Privy logout).
  // Only walletClient.account.address is in deps — resetStore() modifies
  // isConnected but that does NOT re-trigger this effect.
  const prevAddressRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const currentAddress = walletClient?.account?.address?.toLowerCase()
    const prev = prevAddressRef.current
    if (prev !== undefined && currentAddress !== undefined && prev !== currentAddress) {
      if (isConnectedRef.current) {
        resetStore()
        xmtpWalletAddressRef.current = undefined
      }
    }
    // Only update the ref for real addresses. During a wallet switch wagmi
    // briefly passes through null/undefined; updating the ref at that point
    // would lose the "old address" and prevent detecting the new wallet.
    if (currentAddress !== undefined) {
      prevAddressRef.current = currentAddress
    }
  }, [walletClient?.account?.address, resetStore])

  // Reset XMTP when Privy logs out. authenticated → false does not feed back
  // into this effect, so there is no dependency cycle.
  const prevAuthRef = useRef(authenticated)
  useEffect(() => {
    if (prevAuthRef.current && !authenticated) {
      resetStore()
      xmtpWalletAddressRef.current = undefined
    }
    prevAuthRef.current = authenticated
  }, [authenticated, resetStore])

  const initializeClient = useCallback(async () => {
    if (!walletClient?.account) {
      setError('No wallet connected')
      return
    }

    const currentAddress = walletClient.account.address.toLowerCase()

    if (client && isConnected) {
      if (xmtpWalletAddressRef.current === currentAddress) {
        console.log('XMTP client already initialized')
        return
      }
      // Different wallet connected — reset and re-initialize
      resetStore()
    }

    setIsLoading(true)
    setError(null)

    try {
      // Create XMTP signer from wallet client
      const signer: Signer = {
        type: 'EOA',
        getIdentifier: () => ({
          identifier: walletClient.account.address,
          identifierKind: IdentifierKind.Ethereum,
        }),
        signMessage: async (message: string): Promise<Uint8Array> => {
          try {
            const signature = await walletClient.signMessage({
              message,
              account: walletClient.account,
            })
            // Convert hex signature to bytes
            return hexToBytes(signature)
          } catch (error) {
            console.error('Error signing message:', error)
            throw error
          }
        },
      }

      // Create XMTP client
      const xmtpClient = await Client.create(signer, {
        env: "production", // Use 'production' for mainnet
        loggingLevel: 3, // Set logging level to debug for development
      } as any) // Cast to any to bypass type issues with loggingLevel

      xmtpWalletAddressRef.current = currentAddress
      setClient(xmtpClient)
      setIsConnected(true)
      console.log(`XMTP client initialized for inbox:`, xmtpClient.inboxId, xmtpClient)
    } catch (err) {
      console.error('Failed to initialize XMTP client:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize XMTP client')
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }, [walletClient, client, isConnected, setClient, setIsConnected, setError, setIsLoading, resetStore])

  const disconnect = useCallback(() => {
    resetStore()
  }, [resetStore])

  const removeAllInstallations = useCallback(async () => {
    if (!client) {
      setError('No XMTP client connected')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await client.revokeAllOtherInstallations()
      console.log('Successfully revoked all other installations')
      // Disconnect after revoking
      disconnect()
    } catch (err) {
      console.error('Failed to revoke installations:', err)
      setError(err instanceof Error ? err.message : 'Failed to revoke installations')
    } finally {
      setIsLoading(false)
    }
  }, [client, disconnect, setIsLoading, setError])

  return {
    client,
    isLoading,
    error,
    isConnected,
    initializeClient,
    disconnect,
    removeAllInstallations,
  }
}
