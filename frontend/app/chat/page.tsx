'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ProtocolListingLayout } from '../protocol/ProtocolListingLayout'
import { TitleText } from '@/components/StandardFonts'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useAccount } from 'wagmi'
import type { Conversation, DecodedMessage, Identifier } from '@xmtp/browser-sdk'
import { ConsentState, IdentifierKind } from '@xmtp/browser-sdk'

interface GroupMemberInput {
  id: string
  address: string
}

interface GroupChatInfo {
  conversation: Conversation
  memberAddresses: string[]
  uninitializedMembers: string[]
  isOptimistic: boolean
}

export default function ChatPage() {
  const { address } = useAccount()
  const { client, isLoading, error, isConnected, initializeClient } = useXmtpClient()
  
  const [groupChats, setGroupChats] = useState<GroupChatInfo[]>([])
  const [selectedGroupChat, setSelectedGroupChat] = useState<GroupChatInfo | null>(null)
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [memberInputs, setMemberInputs] = useState<GroupMemberInput[]>([
    { id: '1', address: '' }
  ])
  const [isLoadingGroupChats, setIsLoadingGroupChats] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Add new member input slot
  const addMemberSlot = () => {
    setMemberInputs(prev => [
      ...prev,
      { id: Date.now().toString(), address: '' }
    ])
  }

  // Remove member input slot
  const removeMemberSlot = (id: string) => {
    if (memberInputs.length > 1) {
      setMemberInputs(prev => prev.filter(input => input.id !== id))
    }
  }

  // Update member address
  const updateMemberAddress = (id: string, address: string) => {
    setMemberInputs(prev =>
      prev.map(input => input.id === id ? { ...input, address } : input)
    )
  }

  // Check if addresses are initialized with XMTP
  const checkMemberInitialization = async (addresses: string[]): Promise<string[]> => {
    if (!client) return addresses
    if (addresses.length === 0) return []

    const uninitializedMembers: string[] = []
    
    try {
      // Convert addresses to Identifier objects
      const identifiers: Identifier[] = addresses.map(addr => ({
        identifier: addr,
        identifierKind: IdentifierKind.Ethereum
      }))
      
      // Check which addresses can message
      const canMessageMap = await client.canMessage(identifiers)
      
      for (const addr of addresses) {
        const canMessage = canMessageMap.get(addr)
        if (!canMessage) {
          uninitializedMembers.push(addr)
        }
      }
    } catch (err) {
      console.error('Failed to check if addresses can message:', err)
      // If check fails, assume all are uninitialized
      return addresses
    }
    
    return uninitializedMembers
  }

  // Load group chats when client is connected
  useEffect(() => {
    if (!client || !isConnected) return

    const loadGroupChats = async () => {
      setIsLoadingGroupChats(true)
      try {
        await client.conversations.sync()
        const allConvos = await client.conversations.list()
        
        // Filter for group chats only
        const groupConvos = allConvos.filter((convo: any) => {
          // Check if it's a group by looking for group-specific properties
          return 'addMembers' in convo || convo.conversationType === 'group'
        })

        // Create GroupChatInfo objects
        const groupChatInfos: GroupChatInfo[] = await Promise.all(
          groupConvos.map(async (convo: any) => {
            const members: string[] = []
            let isOptimistic = false
            
            // Try to get member list (may not be available for all group types)
            try {
              if ('members' in convo && typeof convo.members === 'function') {
                const memberList = await convo.members()
                members.push(...memberList.map((m: any) => m.inboxId || m.accountAddress || 'Unknown'))
              }
              
              // Check if group is synced to network
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

            return {
              conversation: convo,
              memberAddresses: members,
              uninitializedMembers,
              isOptimistic
            }
          })
        )

        setGroupChats(groupChatInfos)
      } catch (err) {
        console.error('Failed to load group chats:', err)
      } finally {
        setIsLoadingGroupChats(false)
      }
    }

    loadGroupChats()

    // Stream new conversations
    const streamConversations = async () => {
      try {
        const stream = await client.conversations.stream()
        for await (const conversation of stream) {
          // Only add if it's a group chat
          if ('addMembers' in conversation || (conversation as any).conversationType === 'group') {
            const members: string[] = []
            try {
              if ('members' in conversation && typeof (conversation as any).members === 'function') {
                const memberList = await (conversation as any).members()
                members.push(...memberList.map((m: any) => m.inboxId || m.accountAddress || 'Unknown'))
              }
            } catch (err) {
              console.error('Error getting group members:', err)
            }

            const uninitializedMembers = await checkMemberInitialization(members)

            setGroupChats(prev => {
              const exists = prev.some(g => g.conversation.id === conversation.id)
              if (exists) return prev
              return [{
                conversation,
                memberAddresses: members,
                uninitializedMembers,
                isOptimistic: false
              }, ...prev]
            })
          }
        }
      } catch (err) {
        console.error('Error streaming conversations:', err)
      }
    }

    streamConversations()
  }, [client, isConnected])

  // Load messages for selected group chat
  useEffect(() => {
    if (!selectedGroupChat) return

    const loadMessages = async () => {
      try {
        await selectedGroupChat.conversation.sync()
        const msgs = await selectedGroupChat.conversation.messages()
        setMessages(msgs)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }

    loadMessages()
  }, [selectedGroupChat])

  // Stream all messages from all conversations
  useEffect(() => {
    if (!client || !isConnected) return

    const streamMessages = async () => {
      try {
        const stream = await client.conversations.streamAllMessages({
          consentStates: [ConsentState.Allowed],
          onValue: (message) => {
            // Update messages if this is for the selected conversation
            if (selectedGroupChat && message.conversationId === selectedGroupChat.conversation.id) {
              setMessages(prev => {
                const exists = prev.some(m => m.id === message.id)
                if (exists) return prev
                return [...prev, message]
              })
            }
          },
          onError: (error) => {
            console.error('Error streaming messages:', error)
          },
        })
      } catch (err) {
        console.error('Error setting up message stream:', err)
      }
    }

    streamMessages()
  }, [client, isConnected, selectedGroupChat])

  const handleStartGroupChat = async () => {
    if (!client) return

    // Get valid addresses (non-empty)
    const validAddresses = memberInputs
      .map(input => input.address.trim())
      .filter(addr => addr.length > 0)

    setIsCreatingGroup(true)
    try {
      // Create optimistic group chat (stays local until members are added)
      const newGroup = await (client.conversations as any).createGroupOptimistic({
        name: `Group ${groupChats.length + 1}`,
        description: 'Powers Protocol Group Chat'
      })

      // Create group info
      const groupInfo: GroupChatInfo = {
        conversation: newGroup,
        memberAddresses: validAddresses,
        uninitializedMembers: [],
        isOptimistic: validAddresses.length === 0
      }

      // Add to group chats list
      setGroupChats(prev => [groupInfo, ...prev])
      setSelectedGroupChat(groupInfo)

      // If there are addresses, resolve inbox IDs and add members
      if (validAddresses.length > 0) {
        try {
          // Convert addresses to Identifier objects
          const identifiers: Identifier[] = validAddresses.map(addr => ({
            identifier: addr,
            identifierKind: IdentifierKind.Ethereum
          }))
          
          // Check which members can message
          const canMessageMap = await client.canMessage(identifiers)
          const validInboxes: string[] = []
          const uninitializedAddresses: string[] = []

          for (const addr of validAddresses) {
            const canMessage = canMessageMap.get(addr)
            if (canMessage) {
              validInboxes.push(addr)
            } else {
              uninitializedAddresses.push(addr)
            }
          }

          // Update uninitialized members
          groupInfo.uninitializedMembers = uninitializedAddresses
          
          // Add valid members to the group (this syncs the group to the network)
          if (validInboxes.length > 0) {
            await newGroup.addMembers(validInboxes)
            groupInfo.isOptimistic = false
            
            // Update the group chat list
            setGroupChats(prev => prev.map(g => 
              g.conversation.id === newGroup.id ? groupInfo : g
            ))
          }
        } catch (err) {
          console.error('Failed to add members to group:', err)
          alert('Group created but some members could not be added. They may not have XMTP enabled.')
        }
      }

      // Clear inputs
      setMemberInputs([{ id: '1', address: '' }])
    } catch (err) {
      console.error('Failed to create group chat:', err)
      alert('Failed to create group chat.')
    } finally {
      setIsCreatingGroup(false)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedGroupChat || !messageInput.trim()) return

    setIsSending(true)
    try {
      await selectedGroupChat.conversation.sendText(messageInput)
      setMessageInput('')
    } catch (err) {
      console.error('Failed to send message:', err)
      alert('Failed to send message')
    } finally {
      setIsSending(false)
    }
  }

  const formatAddress = (addr: string | undefined) => {
    if (!addr) return 'Unknown'
    if (addr.length <= 10) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString()
  }

  const getGroupName = (groupInfo: GroupChatInfo): string => {
    const convo = groupInfo.conversation as any
    if (convo.name) return convo.name
    if (groupInfo.memberAddresses.length === 0) return 'Empty Group (Optimistic)'
    if (groupInfo.memberAddresses.length === 1) return formatAddress(groupInfo.memberAddresses[0])
    return `Group (${groupInfo.memberAddresses.length} members)`
  }

  return (
    <ProtocolListingLayout>
      <div className="w-full flex-1 flex flex-col items-center p-4 pt-20">
        <div className="max-w-6xl w-full">
          <TitleText 
            title="XMTP Group Chat"
            subtitle="Decentralized group messaging powered by XMTP protocol"
            size={2}
          />

          {/* Connection Status */}
          <div className="mt-8 p-6 border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Connection Status</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {!address && 'Connect your wallet to use XMTP group chat'}
                  {address && !isConnected && 'Click "Connect to XMTP" to start messaging'}
                  {isConnected && `Connected as ${formatAddress(address!)}`}
                </p>
                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              </div>
              
              {address && !isConnected && (
                <button
                  onClick={initializeClient}
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Connecting...' : 'Connect to XMTP'}
                </button>
              )}
              
              {isConnected && client && (
                <div className="text-sm text-green-600 font-medium">
                  ✓ Connected (Inbox: {formatAddress(client.inboxId)})
                </div>
              )}
            </div>
          </div>

          {/* Chat Interface */}
          {isConnected && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
              {/* Group Chats List */}
              <div className="md:col-span-1 border border-slate-200 bg-white shadow-sm flex flex-col">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Group Chats</h3>
                  
                  {/* New Group Chat */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-slate-700 mb-2">Add Members:</div>
                    
                    {/* Member Address Inputs */}
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-2">
                      {memberInputs.map((input, index) => (
                        <div key={input.id} className="flex gap-1">
                          <input
                            type="text"
                            placeholder={`Address ${index + 1}`}
                            value={input.address}
                            onChange={(e) => updateMemberAddress(input.id, e.target.value)}
                            className="flex-1 px-2 py-1.5 border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {memberInputs.length > 1 && (
                            <button
                              onClick={() => removeMemberSlot(input.id)}
                              className="px-2 py-1.5 bg-red-500 text-white text-xs hover:bg-red-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    <button
                      onClick={addMemberSlot}
                      className="w-full px-3 py-1.5 bg-slate-200 text-slate-700 text-xs hover:bg-slate-300 transition-colors"
                    >
                      + Add Member Slot
                    </button>
                    
                    <button
                      onClick={handleStartGroupChat}
                      disabled={isCreatingGroup}
                      className="w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm transition-colors font-medium"
                    >
                      {isCreatingGroup ? 'Creating...' : 'Start Group Chat'}
                    </button>
                    
                    <p className="text-xs text-slate-500 text-center">
                      Creates optimistically. Add 0+ members.
                    </p>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {isLoadingGroupChats ? (
                    <div className="p-4 text-center text-slate-500 text-sm">Loading group chats...</div>
                  ) : groupChats.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">No group chats yet</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {groupChats.map((groupInfo) => {
                        const groupName = getGroupName(groupInfo)
                        return (
                          <button
                            key={groupInfo.conversation.id}
                            onClick={() => setSelectedGroupChat(groupInfo)}
                            className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                              selectedGroupChat?.conversation.id === groupInfo.conversation.id 
                                ? 'bg-blue-50 border-l-4 border-blue-600' 
                                : ''
                            }`}
                          >
                            <div className="font-medium text-slate-800 text-sm truncate">
                              {groupName}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {groupInfo.conversation.createdAt 
                                ? formatTimestamp(groupInfo.conversation.createdAt) 
                                : 'Unknown time'}
                            </div>
                            {groupInfo.isOptimistic && (
                              <div className="text-xs text-orange-600 mt-1 font-medium">
                                ⚠ Optimistic (not synced)
                              </div>
                            )}
                            {groupInfo.uninitializedMembers.length > 0 && (
                              <div className="text-xs text-red-600 mt-1">
                                {groupInfo.uninitializedMembers.length} uninitialized member{groupInfo.uninitializedMembers.length !== 1 ? 's' : ''}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Panel */}
              <div className="md:col-span-2 border border-slate-200 bg-white shadow-sm flex flex-col">
                {selectedGroupChat ? (
                  <>
                    {/* Messages Header */}
                    <div className="p-4 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800">
                        {getGroupName(selectedGroupChat)}
                      </h3>
                      <div className="text-sm text-slate-500 mt-1">
                        {selectedGroupChat.memberAddresses.length} member{selectedGroupChat.memberAddresses.length !== 1 ? 's' : ''}
                        {selectedGroupChat.uninitializedMembers.length > 0 && (
                          <span className="text-red-600 ml-2">
                            ({selectedGroupChat.uninitializedMembers.length} not initialized)
                          </span>
                        )}
                      </div>
                      {selectedGroupChat.uninitializedMembers.length > 0 && (
                        <div className="mt-2 p-2 bg-red-50 border border-red-200 text-xs">
                          <div className="font-medium text-red-800 mb-1">Uninitialized members:</div>
                          {selectedGroupChat.uninitializedMembers.map((addr, idx) => (
                            <div key={idx} className="text-red-700">{formatAddress(addr)}</div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Messages List */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.length === 0 ? (
                        <div className="text-center text-slate-400 text-sm mt-8">
                          No messages yet. Start the conversation!
                        </div>
                      ) : (
                        messages.map((message) => {
                          const isOwnMessage = message.senderInboxId === client?.inboxId
                          const messageContent = typeof message.content === 'string' 
                            ? message.content 
                            : JSON.stringify(message.content)
                          
                          return (
                            <div
                              key={message.id}
                              className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] px-4 py-2 ${
                                  isOwnMessage
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                <div className="text-sm break-words">{messageContent}</div>
                                <div
                                  className={`text-xs mt-1 ${
                                    isOwnMessage ? 'text-blue-100' : 'text-slate-500'
                                  }`}
                                >
                                  {formatTimestamp(message.sentAt)}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Message Input */}
                    <div className="p-4 border-t border-slate-200">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Type a message..."
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                          className="flex-1 px-4 py-2 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSending}
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim() || isSending}
                          className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                        >
                          {isSending ? 'Sending...' : 'Send'}
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-slate-400">
                    <div className="text-center">
                      <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-lg font-medium">No group chat selected</p>
                      <p className="text-sm mt-1">Select a group chat or start a new one</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtocolListingLayout>
  )
}
