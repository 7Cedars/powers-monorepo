import { useState, useEffect, useCallback } from 'react'
import { Client, type Signer } from '@xmtp/browser-sdk'
import { IdentifierKind } from '@xmtp/browser-sdk'
import { useWalletClient } from 'wagmi'
import { hexToBytes } from 'viem'

export function useXmtpClient() {
  const { data: walletClient } = useWalletClient()
  const [client, setClient] = useState<Client | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const initializeClient = useCallback(async () => {
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
        env: 'dev', // Use 'production' for mainnet
      })

      setClient(xmtpClient)
      setIsConnected(true)
      console.log('XMTP client initialized for inbox:', xmtpClient.inboxId)
    } catch (err) {
      console.error('Failed to initialize XMTP client:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize XMTP client')
      setIsConnected(false)
    } finally {
      setIsLoading(false)
    }
  }, [walletClient])

  const disconnect = useCallback(() => {
    setClient(null)
    setIsConnected(false)
  }, [])

  return {
    client,
    isLoading,
    error,
    isConnected,
    initializeClient,
    disconnect,
  }
}
