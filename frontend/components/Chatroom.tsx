'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatBubbleBottomCenterTextIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useConnection, useSignMessage } from 'wagmi'
import { getAddress, isAddress } from 'viem'
import type { Conversation, DecodedMessage, Identifier } from '@xmtp/browser-sdk'
import { ConsentState, IdentifierKind } from '@xmtp/browser-sdk'
import { SearchFilterSort } from './SearchFilterSort'

interface GroupChatInfo {
  conversation: Conversation
  memberAddresses: string[]
  uninitializedMembers: string[]
  isOptimistic: boolean
}

interface ChatroomProps {
  chatroomType?: 'Mandate' | 'Flow' | 'Action' | 'Vote' | 'General'
  hasRole?: boolean
  chainId?: string
  powersAddress?: string
  contextId?: string  // mandateId or actionId depending on type
}

export function Chatroom({ chatroomType = 'Mandate', hasRole = true, chainId, powersAddress, contextId }: ChatroomProps) {
  const { address } = useConnection ()
  const { client, isLoading, error, isConnected, initializeClient, removeAllInstallations } = useXmtpClient()
  const { signMessageAsync } = useSignMessage()
  
  const [groupChat, setGroupChat] = useState<GroupChatInfo | null>(null)
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [createGroupError, setCreateGroupError] = useState<string | null>(null)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [inboxToAddress, setInboxToAddress] = useState<Map<string, string>>(new Map())
  const [sendError, setSendError] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [showMembersList, setShowMembersList] = useState(false)
  const [newMemberAddress, setNewMemberAddress] = useState('')
  const [addNewMemberError, setAddNewMemberError] = useState<string | null>(null)
  const [groupExistsButNotMember, setGroupExistsButNotMember] = useState(false)
  const [isRequestingAccess, setIsRequestingAccess] = useState(false)
  const [requestAccessError, setRequestAccessError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Generate base chatroom identifier (without timestamp)
  // Used for signature verification and group searching
  const getBaseChatroomId = (): string | null => {
    if (!chainId || !powersAddress) return null
    
    const parts = [chatroomType, chainId, powersAddress]
    if (contextId) parts.push(contextId)
    
    return parts.join('-')
  }
  
  const baseChatroomId = getBaseChatroomId()
 
  // Check if connected user is in the uninitialized members list
  const connectedUserNeedsInit = address && groupChat?.uninitializedMembers.some(
    addr => addr.toLowerCase() === address.toLowerCase()
  )
  
  // Check if user's inbox is already in the group
  const isUserInGroup = useCallback(async (): Promise<boolean> => {
    if (!client || !groupChat) return false
    
    try {
      const members = await (groupChat.conversation as any).members()
      const userInboxId = client.inboxId
      
      return members.some((m: any) => m.inboxId === userInboxId)
    } catch (err) {
      console.error('Failed to check if user is in group:', err)
      return false
    }
  }, [client, groupChat])
  
  const [userInGroup, setUserInGroup] = useState<boolean | null>(null)
  
  // Check if user is in the group when group changes
  useEffect(() => {
    if (groupChat && client) {
      isUserInGroup().then(setUserInGroup)
    }
  }, [groupChat, client, isUserInGroup])
  
  console.log('NB: XMTP Chatroom render:', { client, address, isConnected, connectedUserNeedsInit, groupChat, messages, error, baseChatroomId })

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  // Check if addresses are initialized with XMTP
  const checkMemberInitialization = async (addresses: string[]): Promise<string[]> => {
    if (!client) return addresses
    if (addresses.length === 0) return []

    const uninitializedMembers: string[] = []
    
    try {
      const identifiers: Identifier[] = addresses.map(addr => ({
        identifier: addr,
        identifierKind: IdentifierKind.Ethereum
      }))
      
      const canMessageMap = await client.canMessage(identifiers)
      
      for (const addr of addresses) {
        const canMessage = canMessageMap.get(addr)
        if (!canMessage) {
          uninitializedMembers.push(addr)
        }
      }
    } catch (err) {
      console.error('Failed to check if addresses can message:', err)
      return addresses
    }
    
    return uninitializedMembers
  }

  // Load existing group chats when client is connected
  useEffect(() => {
    if (!client || !isConnected || !baseChatroomId) return

    const loadGroupChats = async () => {
      setIsLoadingChats(true)
      try {
        await client.conversations.sync()
        const allConvos = await client.conversations.list()

        console.log('All conversations:', allConvos)
        console.log('Looking for chatroom with base ID:', baseChatroomId)
        
        // Filter for group chats only
        const groupConvos = allConvos.filter((convo: any) => {
          return 'addMembers' in convo || convo.conversationType === 'group'
        })

        // Find all chatrooms matching our base identifier (may have timestamp suffix)
        // Check both name and description fields (network-persisted, cross-browser compatible)
        const matchingConvos = groupConvos.filter((convo: any) => {
          const name = convo.name || ''
          const description = convo.description || ''
          
          // Pattern match: group name/description should start with base chatroom ID
          // Agent creates groups with format: baseChatroomId-timestamp
          return name.startsWith(baseChatroomId) || description.startsWith(baseChatroomId)
        })
        
        console.log(`Found ${matchingConvos.length} matching conversations for base ID: ${baseChatroomId}`)
        
        // If multiple matches, select the most recent (highest timestamp suffix)
        let matchingConvo = null
        if (matchingConvos.length > 0) {
          // Sort by name/description to get the one with highest timestamp
          matchingConvo = matchingConvos.sort((a: any, b: any) => {
            const aName = a.name || a.description || ''
            const bName = b.name || b.description || ''
            return bName.localeCompare(aName) // Descending order
          })[0]
          
          console.log('Selected most recent conversation:', matchingConvo.id, 'name:', (matchingConvo as any).name)
        }

        if (matchingConvo) {
          // Load the matching chatroom
          const convo = matchingConvo as any
          const members: string[] = []
          let isOptimistic = false
          const mapping = new Map<string, string>()
          
          try {
            if ('members' in convo && typeof convo.members === 'function') {
              const memberList = await convo.members()
              console.log('Group members:', memberList)
              memberList.forEach((m: any) => {
                const inboxId = m.inboxId || 'Unknown'
                const ethAddress = m.accountIdentifiers?.[0].identifier || m.accountAddress || inboxId
                members.push(ethAddress)
                if (ethAddress && ethAddress !== inboxId) {
                  mapping.set(inboxId, ethAddress)
                }
              })
            }
            
            if ('sync' in convo) {
              try {
                await convo.sync()
                isOptimistic = false
              } catch (err) {
                isOptimistic = true
              }
            }
          } catch (err) {
            console.error('Error getting group members:', err)
          }

          const uninitializedMembers = await checkMemberInitialization(members)

          console.log('@checkMemberInitialization: uninitializedMembers:', uninitializedMembers)

          setInboxToAddress(mapping)
          setGroupChat({
            conversation: convo,
            memberAddresses: members,
            uninitializedMembers,
            isOptimistic
          })
        }
      } catch (err) {
        console.error('Failed to load group chats:', err)
      } finally {
        setIsLoadingChats(false)
      }
    }

    loadGroupChats()

    // Stream new conversations
    const streamConversations = async () => {
      try {
        const stream = await client.conversations.stream()
        for await (const conversation of stream) {
          if ('addMembers' in conversation || (conversation as any).conversationType === 'group') {
            // Check if this is the chatroom we're looking for (pattern match)
            const name = (conversation as any).name || ''
            const desc = (conversation as any).description || ''
            if (!name.startsWith(baseChatroomId) && !desc.startsWith(baseChatroomId)) {
              continue
            }
            
            const members: string[] = []
            try {
              if ('members' in conversation && typeof (conversation as any).members === 'function') {
                const memberList = await (conversation as any).members()
                members.push(...memberList.map((m: any) =>  m.accountIdentifiers?.[0]?.identifier || m.accountAddress || m.inboxId || 'Unknown'))
              }
            } catch (err) {
              console.error('Error getting group members:', err)
            }

            const uninitializedMembers = await checkMemberInitialization(members)

            if (!groupChat) {
              setGroupChat({
                conversation,
                memberAddresses: members,
                uninitializedMembers,
                isOptimistic: false
              })
            }
          }
        }
      } catch (err) {
        console.error('Error streaming conversations:', err)
      }
    }

    streamConversations()
  }, [client, isConnected, baseChatroomId])

  // Load messages for the group chat
  useEffect(() => {
    if (!groupChat) return

    const loadMessages = async () => {
      try {
        await groupChat.conversation.sync()
        const msgs = await groupChat.conversation.messages()
        setMessages(msgs)
        setSendError(null)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }

    loadMessages()
  }, [groupChat])

  // Stream all messages
  useEffect(() => {
    console.log('Setting up message stream with client:', client, 'isConnected:', isConnected, 'groupChat:', groupChat)
    if (!client || !isConnected || !groupChat) return
    console.log('Streaming messages for conversation ID:', groupChat.conversation.id)

    const streamMessages = async () => {
      try {
        await client.conversations.streamAllMessages({
          consentStates: [ConsentState.Allowed],
          onValue: (message) => {
            if (message.conversationId === groupChat.conversation.id) {
              setMessages(prev => {
                const exists = prev.some(m => m.id === message.id)
                if (exists) return prev
                return [...prev, message]
              })
            }
          },
          onError: (error) => {
            console.error('@streamMessages: Error streaming messages:', error)
          },
        })
      } catch (err) {
        console.error('@streamMessages: Error setting up message stream:', err)
      }
    }

    streamMessages()
  }, [client, isConnected, groupChat])

  const handleCreateGroupChat = async () => {
    if (!client || !baseChatroomId || !address || !chainId || !powersAddress) {
      console.error('@handleCreateGroupChat: Missing required parameters')
      return
    }

    console.log('@handleCreateGroupChat: Requesting bot to create group:', baseChatroomId)
    
    setIsCreatingGroup(true)
    setCreateGroupError(null)
    
    try {
      // 1. Generate timestamp and message to sign (using base chatroom ID)
      const timestamp = Date.now()
      const message = `Create XMTP group: ${baseChatroomId} at ${timestamp}`
      
      console.log('@handleCreateGroupChat: Requesting signature from user...')
      
      // 2. Request signature from user's wallet
      let signature: string
      try {
        signature = await signMessageAsync({ message })
      } catch (signErr) {
        console.error('@handleCreateGroupChat: User rejected signature:', signErr)
        setCreateGroupError('Signature required to create group')
        return
      }
      
      console.log('@handleCreateGroupChat: Signature received, calling bot API...')
      
      // 3. Call bot API to create the group
      const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || 'https://xmtp-agent-production-f937.up.railway.app'
      
      const response = await fetch(`${botApiUrl}/api/create-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chatroomType,
          chainId,
          powersAddress,
          contextId,
          requesterAddress: address,
          signature,
          timestamp,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        console.error('@handleCreateGroupChat: Bot API error:', result)
        setCreateGroupError(result.error || 'Failed to create group via bot')
        return
      }
      
      console.log('@handleCreateGroupChat: Bot created group successfully:', result)
      
      // 4. Wait a moment for XMTP network propagation
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // 5. Sync and find the newly created group
      console.log('@handleCreateGroupChat: Syncing conversations to find new group...')
      await client.conversations.sync()
      const allConvos = await client.conversations.list()
      
      const groupConvos = allConvos.filter((convo: any) => {
        return 'addMembers' in convo || convo.conversationType === 'group'
      })
      
      // Find all matching groups (may have timestamp suffix from agent)
      const matchingConvos = groupConvos.filter((convo: any) => {
        const name = convo.name || ''
        const description = convo.description || ''
        return name.startsWith(baseChatroomId) || description.startsWith(baseChatroomId)
      })
      
      // Select the most recent one (highest timestamp)
      const matchingConvo = matchingConvos.length > 0 ? matchingConvos.sort((a: any, b: any) => {
        const aName = a.name || a.description || ''
        const bName = b.name || b.description || ''
        return bName.localeCompare(aName) // Descending order
      })[0] : null
      
      if (matchingConvo) {
        console.log('@handleCreateGroupChat: Found newly created group')
        
        // Load group details
        const convo = matchingConvo as any
        const members: string[] = []
        const mapping = new Map<string, string>()
        
        try {
          if ('members' in convo && typeof convo.members === 'function') {
            const memberList = await convo.members()
            memberList.forEach((m: any) => {
              const inboxId = m.inboxId || 'Unknown'
              const ethAddress = m.accountIdentifiers?.[0].identifier || m.accountAddress || inboxId
              members.push(ethAddress)
              if (ethAddress && ethAddress !== inboxId) {
                mapping.set(inboxId, ethAddress)
              }
            })
          }
          
          await convo.sync()
        } catch (err) {
          console.error('@handleCreateGroupChat: Error loading group members:', err)
        }
        
        const uninitializedMembers = await checkMemberInitialization(members)
        
        setInboxToAddress(mapping)
        setGroupChat({
          conversation: convo,
          memberAddresses: members,
          uninitializedMembers,
          isOptimistic: false
        })
        
        console.log('@handleCreateGroupChat: Group loaded successfully')
      } else {
        console.warn('@handleCreateGroupChat: Group created but user is not a member')
        // Group was created but user is not a member - show appropriate message
        setGroupExistsButNotMember(true)
      }
      
    } catch (err) {
      console.error('@handleCreateGroupChat: Failed to create group via bot:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to create group'
      setCreateGroupError(errorMessage)
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const handleSendMessage = async () => {
    console.log('@handleSendMessage: Attempting to send message:', messageInput)
    if (!groupChat || !messageInput.trim() || !client) return

    const messageText = messageInput.trim()
    console.log('@handleSendMessage: Sending message:', messageText)
    setIsSending(true)
    setSendError(null)
    
    try {
      // Send the message
      const msgId = await groupChat.conversation.sendText(messageText)
      console.log('@handleSendMessage: Message sent:', messageText, 'Message ID:', msgId)
      
      // Clear input immediately after successful send
      setMessageInput('')
      
      // Try to sync, but don't fail the whole operation if sync has issues
      try {
        await groupChat.conversation.sync()
      } catch (syncErr) {
        // Log sync warnings but don't treat them as fatal errors
        console.warn('@handleSendMessage: Sync completed with warnings:', syncErr)
      }
      console.log('@handleSendMessage: Sync completed (with or without warnings) after sending message')
      
      // Always attempt to reload messages, even if sync reported issues
      try {
        const updatedMessages = await groupChat.conversation.messages()
        console.log('@handleSendMessage: Messages reloaded after send:', updatedMessages)
        setMessages(updatedMessages)
        console.log('@handleSendMessage: Message sent and loaded successfully')
      } catch (loadErr) {
        console.error('@handleSendMessage: Failed to reload messages after send:', loadErr)
        // Don't show this as an error to user - the message was still sent
      }
      
    } catch (err) {
      console.error('@handleSendMessage: Failed to send message:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message'
      setSendError(errorMessage)
      
      // Log the full error for debugging
      console.error('Full error details:', err)
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return 'Unknown'
    if (addr.length <= 10) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  const handleAddConnectedAddress = async () => {
    if (!client || !groupChat || !address) return

    // Check if address is already a member
    const isAlreadyMember = groupChat.memberAddresses.some(
      (memberAddr) => memberAddr.toLowerCase() === address.toLowerCase()
    )
    
    if (isAlreadyMember) {
      setAddMemberError('Your wallet address is already a member of this group')
      setTimeout(() => setAddMemberError(null), 3000)
      return
    }

    setIsAddingMember(true)
    setAddMemberError(null)

    try {
      // Check if the address can message on XMTP
      const identifier: Identifier = {
        identifier: address,
        identifierKind: IdentifierKind.Ethereum
      }
      
      const canMessageMap = await client.canMessage([identifier])
      const canMessage = canMessageMap.get(address)

      if (!canMessage) {
        setAddMemberError('Your wallet address is not initialized with XMTP')
        setTimeout(() => setAddMemberError(null), 5000)
        return
      }

      // Get the inbox ID by creating a DM with this address
      try {
        console.log('Attempting to create DM to get inbox ID for:', address)
        
        // First, check if we can message this address
        const dmIdentifier = await client.conversations.fetchDmByIdentifier({
          identifier: address,
          identifierKind: IdentifierKind.Ethereum
        })
        
        console.log('fetchDmByIdentifier result:', dmIdentifier)
        
        if (!dmIdentifier) {
          setAddMemberError('Could not create DM with this address - address may not be on XMTP')
          setTimeout(() => setAddMemberError(null), 5000)
          return
        }
        
        // Get peer inbox ID from the DM
        const members = await (dmIdentifier as any).members()
        console.log('DM members:', members)
        
        const peerMember = members.find((m: any) => m.inboxId !== client.inboxId)
        
        if (!peerMember || !peerMember.inboxId) {
          setAddMemberError('Could not extract inbox ID from DM')
          setTimeout(() => setAddMemberError(null), 5000)
          return
        }
        
        console.log('Found peer inbox ID:', peerMember.inboxId)
        
        // Add member to group using inbox ID
        await (groupChat.conversation as any).addMembers([peerMember.inboxId])
        
        // Update the group chat info
        const updatedMemberAddresses = [...groupChat.memberAddresses, address]
        const updatedUninitializedMembers = groupChat.uninitializedMembers.filter(
          (addr) => addr.toLowerCase() !== address.toLowerCase()
        )

        setGroupChat({
          ...groupChat,
          memberAddresses: updatedMemberAddresses,
          uninitializedMembers: updatedUninitializedMembers,
          isOptimistic: false
        })

        // Sync the conversation
        await groupChat.conversation.sync()

        console.log('Successfully added connected address to group:', address)
      } catch (dmErr) {
        console.error('Failed to get inbox ID via DM:', dmErr)
        setAddMemberError('Failed to resolve address to inbox ID')
        setTimeout(() => setAddMemberError(null), 5000)
        return
      }
    } catch (err) {
      console.error('Failed to add connected address to group:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add member'
      setAddMemberError(errorMessage)
      setTimeout(() => setAddMemberError(null), 5000)
    } finally {
      setIsAddingMember(false)
    }
  }

  const handleRequestAccess = async () => {
    if (!client || !groupChat || !address || !baseChatroomId) return
    console.log('@handleRequestAccess: Requesting access to group chat with base ID:', baseChatroomId)
    
    setIsRequestingAccess(true)
    setRequestAccessError(null)
    
    try {
      // Get the group name (with timestamp suffix if it exists)
      const groupName = (groupChat.conversation as any).name || (groupChat.conversation as any).description || baseChatroomId
      
      // Generate timestamp and message to sign
      const timestamp = Date.now()
      const message = `Request access to group: ${groupName} at ${timestamp}`
      
      console.log('@handleRequestAccess: Requesting signature from user...')
      
      // Request signature from user's wallet
      let signature: string
      try {
        signature = await signMessageAsync({ message })
      } catch (signErr) {
        console.error('@handleRequestAccess: User rejected signature:', signErr)
        setRequestAccessError('Signature required to request access')
        return
      }
      
      console.log('@handleRequestAccess: Signature received, calling bot API...')
      
      // Call bot API to request access
      const botApiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || 'https://xmtp-agent-production-f937.up.railway.app'
      
      const response = await fetch(`${botApiUrl}/api/request-access`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inboxId: client.inboxId,
          groupName: groupName,
          requesterAddress: address,
          signature,
          timestamp,
        }),
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        console.error('@handleRequestAccess: Bot API error:', result)
        setRequestAccessError(result.error || 'Failed to request access')
        return
      }
      
      console.log('@handleRequestAccess: Access granted successfully:', result)
      
      // Refresh the group membership status
      const inGroup = await isUserInGroup()
      setUserInGroup(inGroup)
      
      // If now in group, reload the group chat
      if (inGroup) {
        await groupChat.conversation.sync()
      }
      
    } catch (err) {
      console.error('@handleRequestAccess: Failed to request access:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to request access'
      setRequestAccessError(errorMessage)
    } finally {
      setIsRequestingAccess(false)
    }
  }

  const handleAddNewMember = async () => {
    if (!client || !groupChat || !newMemberAddress.trim()) return

    const trimmedAddress = newMemberAddress.trim()

    // Validate address format using viem
    if (!isAddress(trimmedAddress)) {
      setAddNewMemberError('Invalid Ethereum address format')
      setTimeout(() => setAddNewMemberError(null), 3000)
      return
    }

    // Check if address is already a member
    const isAlreadyMember = groupChat.memberAddresses.some(
      (memberAddr) => memberAddr.toLowerCase() === trimmedAddress.toLowerCase()
    )
    
    if (isAlreadyMember) {
      setAddNewMemberError('Address is already a member of this group')
      setTimeout(() => setAddNewMemberError(null), 3000)
      return
    }

    setIsAddingMember(true)
    setAddNewMemberError(null)

    try {
      // Check if the address can message on XMTP using trimmed address
      const identifier: Identifier = {
        identifier: trimmedAddress,
        identifierKind: IdentifierKind.Ethereum
      }
      
      const canMessageMap = await client.canMessage([identifier])
      const canMessage = canMessageMap.get(trimmedAddress)

      if (!canMessage) {
        console.log('Address not found in canMessage map or not initialized')
        setAddNewMemberError('Address is not initialized with XMTP')
        setTimeout(() => setAddNewMemberError(null), 5000)
        return
      }

      // Get the inbox ID by creating a DM with this address
      console.log('Attempting to add member:', trimmedAddress)
      
      try {
        console.log('Attempting to create DM to get inbox ID for:', trimmedAddress)
        
        const dmIdentifier = await client.conversations.fetchDmByIdentifier({
          identifier: trimmedAddress,
          identifierKind: IdentifierKind.Ethereum
        })
        
        console.log('fetchDmByIdentifier result:', dmIdentifier)
        
        if (!dmIdentifier) {
          setAddNewMemberError('Could not create DM with this address - address may not be on XMTP')
          setTimeout(() => setAddNewMemberError(null), 5000)
          return
        }
        
        // Get peer inbox ID from the DM
        const members = await (dmIdentifier as any).members()
        console.log('DM members:', members)
        
        const peerMember = members.find((m: any) => m.inboxId !== client.inboxId)
        
        if (!peerMember || !peerMember.inboxId) {
          setAddNewMemberError('Could not extract inbox ID from DM')
          setTimeout(() => setAddNewMemberError(null), 5000)
          return
        }
        
        console.log('Found peer inbox ID:', peerMember.inboxId)
        
        // Add member to group using inbox ID
        await (groupChat.conversation as any).addMembers([peerMember.inboxId])
        
        // Update the group chat info
        const updatedMemberAddresses = [...groupChat.memberAddresses, trimmedAddress]
        const updatedUninitializedMembers = groupChat.uninitializedMembers.filter(
          (addr) => addr.toLowerCase() === trimmedAddress.toLowerCase()
        )

        setGroupChat({
          ...groupChat,
          memberAddresses: updatedMemberAddresses,
          uninitializedMembers: updatedUninitializedMembers,
          isOptimistic: false
        })

        // Sync the conversation
        await groupChat.conversation.sync()

        // Clear the input on success
        setNewMemberAddress('')

        console.log('Successfully added new member to group:', trimmedAddress)
      } catch (dmErr) {
        console.error('Failed to get inbox ID via DM:', dmErr)
        setAddNewMemberError('Failed to resolve address to inbox ID')
        setTimeout(() => setAddNewMemberError(null), 5000)
        return
      }
    } catch (err) {
      console.error('Failed to add new member to group:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to add member'
      setAddNewMemberError(errorMessage)
      setTimeout(() => setAddNewMemberError(null), 5000)
    } finally {
      setIsAddingMember(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-[600px]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-1 border-b border-border bg-muted/10">
        <div className="flex items-center gap-2">
          <ChatBubbleBottomCenterTextIcon className="h-3 w-3 text-muted-foreground" />
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider">{chatroomType.toUpperCase()} CHATROOM</h4>
          {/* {isConnected && (
            <button
              onClick={removeAllInstallations}
              disabled={isLoading}
              className="ml-2 px-3 py-1 bg-destructive text-destructive-foreground  text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
            >
              Remove All Installations
            </button>
          )} */}
        </div>
        {isConnected && groupChat && (
         <div className="flex items-center justify-between gap-3">
          <SearchFilterSort 
              onSearchChange={(query) => console.log('Search:', query)}
              onFilterChange={(filter) => console.log('Filter:', filter)}
              onSortChange={(sort) => console.log('Sort:', sort)}
            />
          
            <button
              onClick={() => setShowMembersList(!showMembersList)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              | {groupChat.memberAddresses.length}/250 members
            </button>
        </div>
        )}
      </div>

      {/* Members List Modal */}
      {showMembersList && groupChat && (
        <div className="px-6 py-3 border-b border-border bg-muted/5">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-xs font-mono uppercase tracking-wider text-foreground">
              Group Members ({groupChat.memberAddresses.length})
            </h5>
            <button
              onClick={() => setShowMembersList(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
            {groupChat.memberAddresses.map((memberAddr, index) => (
              <div
                key={index}
                className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                {memberAddr}
              </div>
            ))}
          </div>
          {groupChat.uninitializedMembers.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <h6 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Pending XMTP Setup ({groupChat.uninitializedMembers.length})
              </h6>
              <p className="text-xs text-muted-foreground/60 mb-2 italic">
                These members have governance roles but haven't initialized XMTP yet. 
                They need to connect their wallet and complete the one-time XMTP setup to participate in chats.
              </p>
              <div className="max-h-24 overflow-y-auto scrollbar-thin space-y-1">
                {groupChat.uninitializedMembers.map((memberAddr, index) => {
                  const isConnectedUser = address && memberAddr.toLowerCase() === address.toLowerCase()
                  return (
                    <div
                      key={index}
                      className={`text-xs font-mono py-1 flex items-center justify-between ${
                        isConnectedUser ? 'text-primary font-semibold' : 'text-muted-foreground/60'
                      }`}
                    >
                      <span>{memberAddr}</span>
                      {isConnectedUser && (
                        <span className="text-xs bg-primary/20 px-2 py-0.5 rounded">You</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Add New Member Section */}
          <div className="mt-3 pt-3 border-t border-border">
            <h6 className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
              Add Member
            </h6>
            {addNewMemberError && (
              <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20 text-xs text-destructive font-mono">
                {addNewMemberError}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="0x..."
                value={newMemberAddress}
                onChange={(e) => setNewMemberAddress(e.target.value)}
                className="flex-1 bg-background border border-border px-2 py-1 text-xs focus:outline-none focus:border-foreground/50 transition-colors font-mono"
                disabled={isAddingMember}
              />
              <button
                onClick={handleAddNewMember}
                disabled={isAddingMember || !newMemberAddress.trim()}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
              >
                {isAddingMember ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      {!hasRole ? (
        // No role - Show informational message
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <LockClosedIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
            You do not have the required role to execute any actions in this mandate.
          </p>
        </div>
      ) : !address || !isConnected ? (
        // Not connected - Show connection button
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <LockClosedIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mb-2">
            These chatrooms use XMTP, an encrypted Web3 messaging protocol.
          </p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-md mb-4">
            Connect your wallet and initialize XMTP (one-time setup) to participate in governance discussions.
          </p>
          {address && !isConnected && (
            <>
              {!client?.inboxId && (
                <div className="mb-3 p-3 bg-primary/10 border border-primary/20 text-xs font-mono max-w-md">
                  <p className="font-semibold mb-1">🔐 First-Time Setup Required</p>
                  <p className="text-xs opacity-80">
                    This is a one-time process to create your encrypted XMTP identity. 
                    You'll need to sign a message with your wallet.
                  </p>
                </div>
              )}
              <button
                onClick={initializeClient}
                disabled={isLoading}
                className="px-4 py-2 bg-primary text-primary-foreground  text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
              >
                {isLoading ? 'Initializing XMTP...' : !client?.inboxId ? 'Initialize XMTP' : 'Connect to XMTP'}
              </button>
            </>
          )}
          {error && (
            <p className="text-xs text-red-500 mt-2">{error}</p>
          )}
        </div>
      ) : isLoadingChats ? (
        // Loading existing chats
        <div className="flex-1 min-h-0 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Loading chats...</p>
        </div>
      ) : groupExistsButNotMember ? (
        // Group exists but user is not a member
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <LockClosedIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mb-2">
            A group chat exists for this {chatroomType.toLowerCase()}, but you are not a member.
          </p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-md mb-4">
            Only users with the required role can participate in this conversation.
          </p>
          {hasRole && (
            <>
              {requestAccessError && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-xs text-destructive font-mono max-w-md">
                  {requestAccessError}
                </div>
              )}
              <button
                onClick={handleRequestAccess}
                disabled={isRequestingAccess}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
              >
                {isRequestingAccess ? 'Requesting Access...' : 'Request Access'}
              </button>
            </>
          )}
        </div>
      ) : !groupChat ? (
        // Connected but no group chat - Show create button
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <ChatBubbleBottomCenterTextIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mb-4">
            No group chat exists yet. Create one to start discussing this {chatroomType.toLowerCase()}.
          </p>
          {!client?.inboxId && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/20 text-xs text-primary font-mono max-w-md">
              <p className="font-semibold mb-1">⚠️ XMTP Not Fully Initialized</p>
              <p className="text-xs opacity-80">
                Your wallet is connected but your XMTP inbox may not be fully set up. 
                Creating a group will complete the initialization.
              </p>
            </div>
          )}
          {createGroupError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-xs text-destructive font-mono max-w-md">
              {createGroupError}
            </div>
          )}
          <button
            onClick={handleCreateGroupChat}
            disabled={isCreatingGroup}
            className="px-4 py-2 bg-primary text-primary-foreground  text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
          >
            {isCreatingGroup ? 'Creating Group Chat...' : 'Create Group Chat'}
          </button>
        </div>
      ) : (
        // Chat loaded - Show messages or request access if not a member
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Show request access prompt if user has role but is not in group */}
          {hasRole && userInGroup === false && (
            <div className="px-6 py-3 bg-primary/10 border-b border-primary/20">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-xs font-mono font-semibold text-primary mb-1">
                    🔐 Request Access to Group
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    You have the required role for this {chatroomType.toLowerCase()} but are not yet a member of the group chat. 
                    Click below to request access.
                  </p>
                </div>
                <button
                  onClick={handleRequestAccess}
                  disabled={isRequestingAccess}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs hover:opacity-80 transition-opacity disabled:opacity-50 uppercase tracking-wider font-mono whitespace-nowrap"
                >
                  {isRequestingAccess ? 'Requesting...' : 'Request Access'}
                </button>
              </div>
              {requestAccessError && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 text-xs text-destructive font-mono">
                  {requestAccessError}
                </div>
              )}
            </div>
          )}
          
          {/* Show initialization prompt if connected user is uninitialized */}
          {connectedUserNeedsInit && (
            <div className="px-6 py-3 bg-primary/10 border-b border-primary/20">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-xs font-mono font-semibold text-primary mb-1">
                    🔐 Complete Your XMTP Setup
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Your address is in this group but you haven't fully initialized your XMTP identity. 
                    Click below to complete the one-time setup and start participating.
                  </p>
                </div>
                <button
                  onClick={handleAddConnectedAddress}
                  disabled={isAddingMember}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs hover:opacity-80 transition-opacity disabled:opacity-50 uppercase tracking-wider font-mono whitespace-nowrap"
                >
                  {isAddingMember ? 'Initializing...' : 'Initialize & Join'}
                </button>
              </div>
              {addMemberError && (
                <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 text-xs text-destructive font-mono">
                  {addMemberError}
                </div>
              )}
            </div>
          )}
          
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 scrollbar-thin flex flex-col">
            <div className="mt-auto space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground/50 text-xs mt-8">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.senderInboxId === client?.inboxId
                  const messageContent = typeof message.content === 'string' 
                    ? message.content 
                    : JSON.stringify(message.content)
                  
                  // Use Ethereum address if available, otherwise use inbox ID
                  const displayAddress = inboxToAddress.get(message.senderInboxId) || message.senderInboxId
                  
                  return (
                    <div
                      key={message.id}
                      className="font-mono text-xs"
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div>
                            <span className="text-muted-foreground">[{formatTimestamp(message.sentAt)}]</span>
                            <span className={`ml-2 ${isOwnMessage ? 'text-primary' : 'text-foreground'}`}>
                              {formatAddress(displayAddress)}:
                            </span>
                            <span className="text-muted-foreground ml-2">
                              {messageContent}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Message Input */}
          <div className="flex-shrink-0 px-6 py-3 border-t border-border">
            {sendError && (
              <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20  text-xs text-destructive font-mono">
                Failed to send: {sendError}
              </div>
            )}
            {addMemberError && (
              <div className="mb-2 p-2 bg-destructive/10 border border-destructive/20  text-xs text-destructive font-mono">
                {addMemberError}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-background border border-border  px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors font-mono"
                disabled={isSending}
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageInput.trim() || isSending}
                className="px-4 py-2 bg-primary text-primary-foreground  text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
