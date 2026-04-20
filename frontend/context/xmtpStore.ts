import { create } from 'zustand'
import { Client } from '@xmtp/browser-sdk'

interface XmtpStore {
  client: Client | null
  isConnected: boolean
  isLoading: boolean
  error: string | null
  hasInbox: boolean | null // null = unknown, true = has inbox, false = no inbox
  setClient: (client: Client | null) => void
  setIsConnected: (connected: boolean) => void
  setIsLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setHasInbox: (hasInbox: boolean | null) => void
  reset: () => void
}

export const useXmtpStore = create<XmtpStore>((set) => ({
  client: null,
  isConnected: false,
  isLoading: false,
  error: null,
  hasInbox: null,
  setClient: (client) => set({ client }),
  setIsConnected: (connected) => set({ isConnected: connected }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setHasInbox: (hasInbox) => set({ hasInbox }),
  reset: () => set({ 
    client: null, 
    isConnected: false, 
    isLoading: false,
    error: null,
    hasInbox: null
  })
}))
