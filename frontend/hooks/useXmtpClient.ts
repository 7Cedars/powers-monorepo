import { useCallback, useEffect } from 'react'
import { Client, type Signer, type Identifier } from '@xmtp/browser-sdk'
import { IdentifierKind } from '@xmtp/browser-sdk'
import { useWalletClient } from 'wagmi'
import { hexToBytes } from 'viem'
import { useXmtpStore } from '@/context/xmtpStore'

export function useXmtpClient() {
  const { data: walletClient } = useWalletClient()
  
  // Use Zustand store instead of local state
  const client = useXmtpStore((state) => state.client)
  const isLoading = useXmtpStore((state) => state.isLoading)
  const error = useXmtpStore((state) => state.error)
  const isConnected = useXmtpStore((state) => state.isConnected)
  const hasInbox = useXmtpStore((state) => state.hasInbox)
  const setClient = useXmtpStore((state) => state.setClient)
  const setIsLoading = useXmtpStore((state) => state.setIsLoading)
  const setError = useXmtpStore((state) => state.setError)
  const setIsConnected = useXmtpStore((state) => state.setIsConnected)
  const setHasInbox = useXmtpStore((state) => state.setHasInbox)
  const resetStore = useXmtpStore((state) => state.reset)

  // Check if an address has an XMTP inbox
  const checkInboxExists = useCallback(async (address: string): Promise<boolean> => {
    try {
      const identifiers: Identifier[] = [
        { identifier: address, identifierKind: IdentifierKind.Ethereum }
      ]
      
      const response = await Client.canMessage(identifiers)
      const canMessage = response.get(address.toLowerCase()) ?? false
      
      setHasInbox(canMessage)
      return canMessage
    } catch (err) {
      console.error('Failed to check inbox existence:', err)
      setHasInbox(false)
      return false
    }
  }, [setHasInbox])

  // Auto-check inbox existence when wallet connects
  useEffect(() => {
    if (walletClient?.account?.address && !isConnected) {
      checkInboxExists(walletClient.account.address)
    }
  }, [walletClient?.account?.address, isConnected, checkInboxExists])

  const initializeClient = useCallback(async () => {
    // If already connected, don't reinitialize
    if (client && isConnected) {
      console.log('XMTP client already initialized')
      return
    }

    if (!walletClient?.account) {
      setError('No wallet connected')
      return
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
        // env: 'dev', // Use 'production' for mainnet
      })

      setClient(xmtpClient)
      setIsConnected(true)
      setHasInbox(true) // Update hasInbox after successful creation/connection
      console.log(`XMTP client initialized for inbox:`, xmtpClient.inboxId, xmtpClient)
    } catch (err) {
      console.error('Failed to initialize XMTP client:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize XMTP client')
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }, [walletClient, client, isConnected, setClient, setIsConnected, setError, setIsLoading])

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
    hasInbox,
    checkInboxExists,
    initializeClient,
    disconnect,
    removeAllInstallations,
  }
}
