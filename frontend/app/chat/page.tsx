'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ProtocolListingLayout } from '../protocol/ProtocolListingLayout'
import { TitleText } from '@/components/StandardFonts'
import { useXmtpClient } from '@/hooks/useXmtpClient'
import { useAccount } from 'wagmi'
import type { Conversation, DecodedMessage } from '@xmtp/browser-sdk'
import { ConsentState } from '@xmtp/browser-sdk'

export default function ChatPage() {
  const { address } = useAccount()
  const { client, isLoading, error, isConnected, initializeClient } = useXmtpClient()
  
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const [messageInput, setMessageInput] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load conversations when client is connected
  useEffect(() => {
    if (!client || !isConnected) return

    const loadConversations = async () => {
      setIsLoadingConversations(true)
      try {
        await client.conversations.sync()
        const allConvos = await client.conversations.list()
        setConversations(allConvos)
      } catch (err) {
        console.error('Failed to load conversations:', err)
      } finally {
        setIsLoadingConversations(false)
      }
    }

    loadConversations()

    // Stream new conversations
    const streamConversations = async () => {
      try {
        const stream = await client.conversations.stream()
        for await (const conversation of stream) {
          setConversations(prev => {
            const exists = prev.some(c => c.id === conversation.id)
            if (exists) return prev
            return [conversation, ...prev]
          })
        }
      } catch (err) {
        console.error('Error streaming conversations:', err)
      }
    }

    streamConversations()
  }, [client, isConnected])

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return

    const loadMessages = async () => {
      try {
        await selectedConversation.sync()
        const msgs = await selectedConversation.messages()
        setMessages(msgs)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }

    loadMessages()
  }, [selectedConversation])

  // Stream all messages from all conversations
  useEffect(() => {
    if (!client || !isConnected) return

    const streamMessages = async () => {
      try {
        const stream = await client.conversations.streamAllMessages({
          consentStates: [ConsentState.Allowed],
          onValue: (message) => {
            // Update messages if this is for the selected conversation
            if (selectedConversation && message.conversationId === selectedConversation.id) {
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
  }, [client, isConnected, selectedConversation])

  const handleStartConversation = async () => {
    if (!client || !recipientAddress.trim()) return

    try {
      // Create new DM conversation (will return existing if already exists)
      const newConvo = await client.conversations.createDm(recipientAddress)
      
      // Check if we already have this conversation in our list
      const exists = conversations.some(c => c.id === newConvo.id)
      if (!exists) {
        setConversations(prev => [newConvo, ...prev])
      }
      
      setSelectedConversation(newConvo)
      setRecipientAddress('')
    } catch (err) {
      console.error('Failed to create conversation:', err)
      alert('Failed to create conversation. Make sure the address is valid and has XMTP enabled.')
    }
  }

  const handleSendMessage = async () => {
    if (!selectedConversation || !messageInput.trim()) return

    setIsSending(true)
    try {
      await selectedConversation.sendText(messageInput)
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
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString()
  }

  const getConversationPeer = (convo: Conversation): string | undefined => {
    // For DM conversations, get the peer inbox ID
    if ('peerInboxId' in convo && typeof convo.peerInboxId === 'string') {
      return convo.peerInboxId
    }
    return undefined
  }

  return (
    <ProtocolListingLayout>
      <div className="w-full flex-1 flex flex-col items-center p-4 pt-20">
        <div className="max-w-6xl w-full">
          <TitleText 
            title="XMTP Chat"
            subtitle="Decentralized messaging powered by XMTP protocol"
            size={2}
          />

          {/* Connection Status */}
          <div className="mt-8 p-6 border border-slate-200 rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">Connection Status</h3>
                <p className="text-sm text-slate-500 mt-1">
                  {!address && 'Connect your wallet to use XMTP chat'}
                  {address && !isConnected && 'Click "Connect to XMTP" to start messaging'}
                  {isConnected && `Connected as ${formatAddress(address!)}`}
                </p>
                {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
              </div>
              
              {address && !isConnected && (
                <button
                  onClick={initializeClient}
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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
              {/* Conversations List */}
              <div className="md:col-span-1 border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="text-lg font-semibold text-slate-800 mb-3">Conversations</h3>
                  
                  {/* New Conversation */}
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Enter Ethereum address"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      onKeyPress={(e) => e.key === 'Enter' && handleStartConversation()}
                    />
                    <button
                      onClick={handleStartConversation}
                      disabled={!recipientAddress.trim()}
                      className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm transition-colors"
                    >
                      Start Conversation
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {isLoadingConversations ? (
                    <div className="p-4 text-center text-slate-500 text-sm">Loading conversations...</div>
                  ) : conversations.length === 0 ? (
                    <div className="p-4 text-center text-slate-400 text-sm">No conversations yet</div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {conversations.map((convo) => {
                        const peerInboxId = getConversationPeer(convo)
                        return (
                          <button
                            key={convo.id}
                            onClick={() => setSelectedConversation(convo)}
                            className={`w-full p-4 text-left hover:bg-slate-50 transition-colors ${
                              selectedConversation?.id === convo.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                            }`}
                          >
                            <div className="font-medium text-slate-800 text-sm truncate">
                              {formatAddress(peerInboxId)}
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              {convo.createdAt ? formatTimestamp(convo.createdAt) : 'Unknown time'}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Messages Panel */}
              <div className="md:col-span-2 border border-slate-200 rounded-lg bg-white shadow-sm flex flex-col">
                {selectedConversation ? (
                  <>
                    {/* Messages Header */}
                    <div className="p-4 border-b border-slate-200">
                      <h3 className="text-lg font-semibold text-slate-800">
                        Chat with {formatAddress(getConversationPeer(selectedConversation))}
                      </h3>
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
                                className={`max-w-[70%] rounded-lg px-4 py-2 ${
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
                          className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={isSending}
                        />
                        <button
                          onClick={handleSendMessage}
                          disabled={!messageInput.trim() || isSending}
                          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <p className="text-lg font-medium">No conversation selected</p>
                      <p className="text-sm mt-1">Select a conversation or start a new one</p>
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
