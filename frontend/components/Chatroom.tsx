'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatBubbleBottomCenterTextIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useConnection } from 'wagmi'
import { getAddress, isAddress } from 'viem'
import type { Conversation, DecodedMessage, Identifier } from '@xmtp/browser-sdk'
import { ConsentState, IdentifierKind } from '@xmtp/browser-sdk'
import { SearchFilterSort } from './SearchFilterSort'

// Hardcoded addresses for group chat creation - for demo purposes only
const HARDCODED_ADDRESSES = [
  '0x71B17aABB5007b903c057CcCE2A29F055f64a211'
]

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
  
  const [groupChat, setGroupChat] = useState<GroupChatInfo | null>(null)
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [inboxToAddress, setInboxToAddress] = useState<Map<string, string>>(new Map())
  const [sendError, setSendError] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [showMembersList, setShowMembersList] = useState(false)
  const [newMemberAddress, setNewMemberAddress] = useState('')
  const [addNewMemberError, setAddNewMemberError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Generate unique chatroom identifier
  const getChatroomId = (): string | null => {
    if (!chainId || !powersAddress) return null
    
    const parts = [chatroomType, chainId, powersAddress]
    if (contextId) parts.push(contextId)
    
    return parts.join('-')
  }
  
  const chatroomId = getChatroomId()
 
  console.log('NB: XMTP Chatroom render:', { client, address, isConnected, groupChat, messages, error, chatroomId })

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
    if (!client || !isConnected || !chatroomId) return

    const loadGroupChats = async () => {
      setIsLoadingChats(true)
      try {
        await client.conversations.sync()
        const allConvos = await client.conversations.list()

        console.log('All conversations:', allConvos)
        console.log('Looking for chatroom with ID:', chatroomId)
        
        // Filter for group chats only
        const groupConvos = allConvos.filter((convo: any) => {
          return 'addMembers' in convo || convo.conversationType === 'group'
        })

        // Find the specific chatroom matching our identifier
        // Check both name and description fields (network-persisted, cross-browser compatible)
        const matchingConvo = groupConvos.find((convo: any) => {
          // Priority 1: Check name field (most reliable)
          if (convo.name && convo.name === chatroomId) {
            console.log('Found chat by name match:', convo.id, 'name:', convo.name)
            return true
          }
          
          // Priority 2: Check description field (backup identifier)
          if (convo.description && convo.description === chatroomId) {
            console.log('Found chat by description match:', convo.id, 'description:', convo.description)
            return true
          }
          
          return false
        })
        
        console.log('Matching conversation result:', matchingConvo ? 'Found' : 'Not found', matchingConvo?.id)

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
            // Check if this is the chatroom we're looking for
            if ((conversation as any).description !== chatroomId) {
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
  }, [client, isConnected, chatroomId])

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
    console.log('@handleCreateGroupChat: Creating group chat with addresses:', HARDCODED_ADDRESSES)
    if (!client || !chatroomId) return

    console.log('@handleCreateGroupChat: Creating group chat with ID:', chatroomId)

    setIsCreatingGroup(true)
    try {
      // Create optimistic group chat with chatroomId in BOTH name and description
      // This ensures cross-browser recognition via network-persisted metadata
      const newGroup = await (client.conversations as any).createGroupOptimistic({
        name: chatroomId,         // Primary identifier
        description: chatroomId   // Backup identifier (stored on network)
      })

      console.log('@handleCreateGroupChat: Created optimistic group:', {
        id: newGroup.id,
        name: newGroup.name,
        description: newGroup.description
      })

      // Create group info
      const groupInfo: GroupChatInfo = {
        conversation: newGroup,
        memberAddresses: HARDCODED_ADDRESSES,
        uninitializedMembers: [],
        isOptimistic: HARDCODED_ADDRESSES.length === 0
      }

      setGroupChat(groupInfo)

      // Add members if there are any
      if (HARDCODED_ADDRESSES.length > 0) {
        try {
          const identifiers: Identifier[] = HARDCODED_ADDRESSES.map(addr => ({
            identifier: addr,
            identifierKind: IdentifierKind.Ethereum
          }))
          
          const canMessageMap = await client.canMessage(identifiers)
          const validInboxes: string[] = []
          const uninitializedAddresses: string[] = []

          for (const addr of HARDCODED_ADDRESSES) {
            const canMessage = canMessageMap.get(addr)
            if (canMessage) {
              validInboxes.push(addr)
            } else {
              uninitializedAddresses.push(addr)
            }
          }

          groupInfo.uninitializedMembers = uninitializedAddresses
          
          // Sync the group to the network
          // Note: Browser SDK cannot add members by Ethereum address during creation
          // Members must be added after they have inbox IDs
          console.log('@handleCreateGroupChat: Publishing group (members will join manually)')
          await newGroup.publishMessages()
          groupInfo.isOptimistic = false
          
          // Wait for sync to complete
          await newGroup.sync()
          console.log('@handleCreateGroupChat: Group synced to network')
          
          // Update metadata with retry logic to ensure cross-browser persistence
          let metadataUpdateSuccess = false
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              console.log(`@handleCreateGroupChat: Updating metadata (attempt ${attempt + 1}/3)`)
              await newGroup.updateName(chatroomId)
              await newGroup.updateDescription(chatroomId)
              
              // Verify the update succeeded
              await newGroup.sync()
              const updatedName = newGroup.name
              const updatedDescription = newGroup.description
              
              if (updatedName === chatroomId && updatedDescription === chatroomId) {
                console.log('@handleCreateGroupChat: Metadata verified:', {
                  name: updatedName,
                  description: updatedDescription
                })
                metadataUpdateSuccess = true
                break
              } else {
                console.warn('@handleCreateGroupChat: Metadata mismatch:', {
                  expected: chatroomId,
                  actualName: updatedName,
                  actualDescription: updatedDescription
                })
              }
            } catch (err) {
              console.error(`@handleCreateGroupChat: Metadata update attempt ${attempt + 1} failed:`, err)
              if (attempt < 2) {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000))
              }
            }
          }
          
          if (!metadataUpdateSuccess) {
            console.error('@handleCreateGroupChat: Failed to update metadata after 3 attempts')
          }
          
          // Update the group chat info
          setGroupChat({ ...groupInfo })
        } catch (err) {
          console.error('Failed to add members to group:', err)
        }
      }
    } catch (err) {
      console.error('Failed to create group chat:', err)
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
                Uninitialized ({groupChat.uninitializedMembers.length})
              </h6>
              <div className="max-h-24 overflow-y-auto scrollbar-thin space-y-1">
                {groupChat.uninitializedMembers.map((memberAddr, index) => (
                  <div
                    key={index}
                    className="text-xs font-mono text-muted-foreground/60 py-1"
                  >
                    {memberAddr}
                  </div>
                ))}
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
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mb-4">
            These chatrooms are based on the XMTP Web3 Messaging Protocol. They are encrypted and only viewable once a wallet connection is established.
          </p>
          {address && !isConnected && (
            <button
              onClick={initializeClient}
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-primary-foreground  text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
            >
              {isLoading ? 'Connecting to XMTP...' : 'Connect to XMTP'}
            </button>
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
      ) : !groupChat ? (
        // Connected but no group chat - Show create button
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <ChatBubbleBottomCenterTextIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mb-4">
            No group chat exists yet. Create one to start discussing this mandate.
          </p>
          <button
            onClick={handleCreateGroupChat}
            disabled={isCreatingGroup}
            className="px-4 py-2 bg-primary text-primary-foreground  text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
          >
            {isCreatingGroup ? 'Creating Group Chat...' : 'Create Group Chat'}
          </button>
        </div>
      ) : (
        // Chat loaded - Show messages
        <div className="flex-1 min-h-0 flex flex-col">
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
