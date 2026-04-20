'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { ChatBubbleBottomCenterTextIcon, LockClosedIcon } from '@heroicons/react/24/outline'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useConnection, useSignMessage } from 'wagmi' 
import type { Conversation, DecodedMessage, Identifier } from '@xmtp/browser-sdk'
import { ConsentState, IdentifierKind } from '@xmtp/browser-sdk'
import { SearchFilterSort } from './SearchFilterSort'
import { useAddressDisplay } from '@/hooks/useAddressDisplay'

function MemberItem({ address }: { address: string }) {
  const { displayName } = useAddressDisplay(address)
  return (
    <div className="text-xs font-mono py-1.5 px-3 hover:bg-muted/50 cursor-default truncate transition-colors border-b border-border/20 last:border-0" title={address}>
      {displayName}
    </div>
  )
}

interface GroupChatInfo {
  conversation: Conversation
  memberAddresses: string[]
  uninitializedMembers: string[]
  isOptimistic: boolean
}

interface ChatroomProps {
  chatroomType?: 'Mandate' | 'Flow' | 'Action' | 'Vote' | 'General'
  hasRole?: boolean
  isPublicRole?: boolean
  chainId?: string
  powersAddress?: string
  contextId?: string  // mandateId or actionId depending on type
  xmtpAgentAddress?: string
}

export function Chatroom({ chatroomType = 'Mandate', hasRole = true, isPublicRole = false, chainId, powersAddress, contextId, xmtpAgentAddress }: ChatroomProps) {
  const { address } = useConnection ()
  const { client, isLoading, error, isConnected, initializeClient, removeAllInstallations } = useXmtpClient()
  const [groupChat, setGroupChat] = useState<GroupChatInfo | null>(null)
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isLoadingChats, setIsLoadingChats] = useState(false)
  const [inboxToAddress, setInboxToAddress] = useState<Map<string, string>>(new Map())
  const [sendError, setSendError] = useState<string | null>(null)
  const [isAddingMember, setIsAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [showMembersList, setShowMembersList] = useState(false) 
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
        
        // Filter for group chats only (explicitly check conversationType to exclude DMs)
        const groupConvos = allConvos.filter((convo: any) => {
          return 'addMembers' in convo || convo.conversationType === 'group'
        })
        console.log('Group conversations:', groupConvos)

        // Find the exact matching chatroom
        // Check both name and description fields (network-persisted, cross-browser compatible)
        const matchingConvo = groupConvos.find((convo: any) => {
          const name = convo.name || ''
          const description = convo.description || ''
          
          return name === baseChatroomId || description === baseChatroomId
        })
        
        if (matchingConvo) {
          console.log('Selected matching conversation:', matchingConvo.id, 'name:', (matchingConvo as any).name)
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
            // Check if this is the exact chatroom we're looking for
            const name = (conversation as any).name || ''
            const desc = (conversation as any).description || ''
            if (name !== baseChatroomId && desc !== baseChatroomId) {
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

  const handleRequestAccess = async () => {
    if (!client || !address || !baseChatroomId) return
    console.log('@handleRequestAccess: Requesting access to group chat with base ID:', baseChatroomId, 'and agent address:', xmtpAgentAddress)
    console.log('@handleRequestAccess: Client:', client, 'Address:', address)
    
    const agentAddress = xmtpAgentAddress
    if (!agentAddress) {
      setRequestAccessError('Agent address not configured')
      return
    }

    setIsRequestingAccess(true)
    setRequestAccessError(null)
    
    try {
      // Find or create DM with the agent
      const dm = await client.conversations.createDmWithIdentifier({
        identifier: agentAddress,
        identifierKind: IdentifierKind.Ethereum
      })
      
      // Send the chatroom ID as the message
      await dm.sendText(baseChatroomId)
      
      console.log('@handleRequestAccess: Access request sent to agent via DM')
      
      // Request sent successfully. We'll start polling to see if we get added
      // We do a simple interval poll for a minute
      const startTime = Date.now()
      const pollInterval = setInterval(async () => {
        // If we've polled for 60 seconds, stop
        if (Date.now() - startTime > 60000) {
          clearInterval(pollInterval)
          setIsRequestingAccess(false)
          // If we still aren't in the group, we can set an error or just stop
          const stillInGroup = await isUserInGroup()
          if (!stillInGroup) {
            setRequestAccessError('Request timed out. The agent may be offline or you may not have access.')
          }
          return
        }

        try {
          await client.conversations.sync()
          
          // If we don't have a groupChat yet, search for it after sync
          if (!groupChat) {
            const allConvos = await client.conversations.list()
            const matchingConvo = allConvos.find((convo: any) => {
              const isGroup = 'addMembers' in convo || convo.conversationType === 'group'
              if (!isGroup) return false
              const name = convo.name || ''
              const description = convo.description || ''
              return name === baseChatroomId || description === baseChatroomId
            })
            
            if (matchingConvo) {
              // Found the group - set it up and we're done
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
              } catch (err) {
                console.error('Error getting group members:', err)
              }
              
              const uninitializedMembers = await checkMemberInitialization(members)
              setInboxToAddress(mapping)
              setGroupChat({
                conversation: convo,
                memberAddresses: members,
                uninitializedMembers,
                isOptimistic: false
              })
              setUserInGroup(true)
              clearInterval(pollInterval)
              setIsRequestingAccess(false)
              return
            }
          }
          
          // If we already had a groupChat, just check membership
          const inGroup = await isUserInGroup()
          if (inGroup) {
            console.log('@handleRequestAccess: Successfully added to group')
            setUserInGroup(true)
            clearInterval(pollInterval)
            setIsRequestingAccess(false)
            if (groupChat) {
              await groupChat.conversation.sync()
            }
          }
        } catch (err) {
          console.error('Error polling conversations:', err)
        }
      }, 2000) // Poll every 2 seconds
      
    } catch (err) {
      console.error('@handleRequestAccess: Failed to request access:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to send request'
      setRequestAccessError(errorMessage)
      setIsRequestingAccess(false)
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
         <div className="flex items-center justify-between gap-3 relative">
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

            {showMembersList && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-background border border-border shadow-md z-50 max-h-60 overflow-y-auto scrollbar-thin">
                <div className="p-2 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur">
                  Members List
                </div>
                <div className="flex flex-col">
                  {groupChat.memberAddresses.map((addr) => (
                    <MemberItem key={addr} address={addr} />
                  ))}
                </div>
              </div>
            )}
        </div>
        )}
      </div>

      {/* Content Area */}
      {!hasRole ? (
        // No role - Show informational message
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <LockClosedIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
            You do not have the required role to execute any actions in this mandate.
          </p>
        </div>
      ) : isPublicRole ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <LockClosedIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md">
            Due to the risk of spamming, publically accesible mandates do not have xmtp chat enabled.
          </p>
        </div>
      ) : !address || !isConnected ? (
        // Not connected - Show connection button
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <LockClosedIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl mb-2">
            These chatrooms use XMTP, an encrypted Web3 messaging protocol.
          </p>
          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-2xl mb-4">
            Connect your wallet and log in to XMTP to participate in governance discussions.
          </p>
          {address && !isConnected && (
            <> 
              <button
                onClick={initializeClient}
                disabled={isLoading}
                className="px-4 py-2 bg-primary text-primary-foreground  text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
              >
                {isLoading ? 'Logging in...' : !client?.inboxId ? 'Login to XMTP' : 'Connect to XMTP'}
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
      ) : !userInGroup ? (
        // User is not in the group chat - Show request access button
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 py-12 text-center">
          <ChatBubbleBottomCenterTextIcon className="h-6 w-6 text-muted-foreground mb-4 opacity-40" />
          <p className="text-xs text-muted-foreground leading-relaxed max-w-md mb-4">
            Join the conversation to start discussing this {chatroomType.toLowerCase()}.
          </p>
          {!client?.inboxId && (
            <div className="mb-4 p-3 bg-primary/10 border border-primary/20 text-xs text-primary font-mono max-w-md">
              <p className="font-semibold mb-1">⚠️ XMTP Not Fully Initialized</p>
              <p className="text-xs opacity-80">
                Your wallet is connected but your XMTP inbox may not be fully set up. 
                Requesting access will complete the initialization.
              </p>
            </div>
          )}
          {requestAccessError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-xs text-destructive font-mono max-w-md">
              {requestAccessError}
            </div>
          )}
          <button
            onClick={handleRequestAccess}
            disabled={isRequestingAccess}
            className="px-4 py-2 bg-primary text-primary-foreground  text-xs hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider font-mono"
          >
            {isRequestingAccess ? 'Requesting Access...' : 'Request Access'}
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
                  
                  // Check if this is a group update system message
                  const isGroupUpdate = typeof message.content === 'object' && message.content !== null && ('addedInboxes' in message.content || 'initiatedByInboxId' in message.content)
                  
                  let messageContent = ''
                  if (isGroupUpdate) {
                    const content = message.content as any
                    const addedCount = content.addedInboxes?.length || 0
                    const removedCount = content.removedInboxes?.length || 0
                    
                    if (addedCount > 0) {
                      const addedAddrs = content.addedInboxes.map((i: any) => formatAddress(inboxToAddress.get(i.inboxId) || i.inboxId)).join(', ')
                      messageContent = `Added ${addedCount} member${addedCount > 1 ? 's' : ''} (${addedAddrs})`
                    } else if (removedCount > 0) {
                      const removedAddrs = content.removedInboxes.map((i: any) => formatAddress(inboxToAddress.get(i.inboxId) || i.inboxId)).join(', ')
                      messageContent = `Removed ${removedCount} member${removedCount > 1 ? 's' : ''} (${removedAddrs})`
                    } else {
                      messageContent = 'Updated the chatroom'
                    }
                  } else {
                    messageContent = typeof message.content === 'string' 
                      ? message.content 
                      : JSON.stringify(message.content)
                  }
                  
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
                              {formatAddress(displayAddress)}{isGroupUpdate ? ' ' : ':'}
                            </span>
                            <span className={`${isGroupUpdate ? 'text-muted-foreground/70 italic' : 'text-muted-foreground'} ${!isGroupUpdate ? 'ml-2' : ''}`}>
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
