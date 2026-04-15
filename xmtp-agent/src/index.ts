// Main entry point for the XMTP Powers Agent
// This file initializes the agent, starts event watchers, message streaming, and launches the API server

import { initializeAgent } from './agent.js';
import { watchPowersRoleSetEvents } from './watchers/powersRoleSet.js';
import { handlePowersRoleSet } from './handlers/roleChange.js';
import { handleAccessRequestMessage } from './handlers/messageHandler.js';
import { createServer, startServer } from './api/server.js'; 
import { config } from './config/env.js';
import type { Address } from 'viem';
import type { WatchContractEventReturnType } from 'viem';

/**
 * Main application entry point
 */
async function main() {
  console.log('Starting Powers XMTP Agent...');
  console.log('='.repeat(50));
  
  try {
    // 1. Initialize the XMTP agent
    console.log('Initializing XMTP agent...');
    const agent = await initializeAgent();
    console.log('✓ Agent initialized successfully');
    console.log('  Agent address:', agent.address);
    console.log('');
    
    // 2. Start event watchers for each Powers contract
    console.log('Starting event watchers...');
    const unwatchFunctions: WatchContractEventReturnType[] = [];
    
    if (config.powersAddresses.length === 0) {
      console.warn('WARNING: No Powers contract addresses configured in POWERS_ADDRESSES environment variable');
    }
    
    for (const powersAddress of config.powersAddresses) {
      console.log(`  Watching chain ${config.powersChainId}, contract ${powersAddress}`);
      
      const unwatch = watchPowersRoleSetEvents(
        config.powersChainId,
        powersAddress as Address,
        async (event) => {
          // Handle the event
          await handlePowersRoleSet(agent, event);
        }
      );
      
      unwatchFunctions.push(unwatch);
    }
    
    console.log('✓ Event watchers started');
    console.log('');
    
    // 3. Start DM message stream for access requests
    console.log('Starting DM message stream...');
    startMessageStream(agent);
    console.log('✓ DM message stream started');
    console.log('');
    
    // 4. Create and start the API server (health check only)
    console.log('Starting API server...');
    const app = createServer(agent);
    startServer(app);
    console.log('✓ API server started');
    console.log('');
    
    console.log('='.repeat(50));
    console.log('Powers XMTP Agent is running');
    console.log('='.repeat(50));
    console.log('');
    
    // 5. Set up graceful shutdown
    const shutdown = async () => {
      console.log('');
      console.log('Shutting down gracefully...');
      
      // Stop all event watchers
      console.log('Stopping event watchers...');
      for (const unwatch of unwatchFunctions) {
        unwatch();
      }
      console.log('✓ Event watchers stopped');
      
      // Note: Express server will be stopped by process exit
      // Agent SDK handles cleanup automatically
      
      console.log('Shutdown complete');
      process.exit(0);
    };
    
    // Handle shutdown signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    console.error('Failed to start agent:', error);
    process.exit(1);
  }
}

/**
 * Starts streaming all DM messages and routes them to the message handler.
 * Only processes DM messages (not group messages) to avoid feedback loops.
 */
function startMessageStream(agent: any) {
  const streamMessages = async () => {
    try {
      // Stream all messages from all conversations
      await agent.client.conversations.streamAllMessages({
        onValue: async (message: any) => {
          try {
            // Skip messages sent by the agent itself
            if (message.senderInboxId === agent.client.inboxId) {
              return;
            }

            // Only process DM messages (not group messages)
            // Check the conversation type
            const conversationId = message.conversationId;
            
            // Try to find the conversation to check its type
            await agent.client.conversations.sync();
            const allConvos = await agent.client.conversations.list();
            const conversation = allConvos.find((c: any) => c.id === conversationId);
            
            if (!conversation) {
              console.log('[messageStream] Could not find conversation for message, skipping');
              return;
            }

            // Check if this is a DM (not a group)
            const isGroup = 'addMembers' in conversation || (conversation as any).conversationType === 'group';
            
            if (isGroup) {
              // Skip group messages - we only process DMs
              return;
            }

            // Extract message text
            const messageText = typeof message.content === 'string'
              ? message.content
              : JSON.stringify(message.content);

            console.log(`[messageStream] Received DM from ${message.senderInboxId}: ${messageText}`);

            // Create a reply function that sends a DM back
            const replyFn = async (text: string) => {
              try {
                await conversation.sendText(text);
              } catch (err) {
                console.error('[messageStream] Failed to send reply:', err);
              }
            };

            // Handle the message
            await handleAccessRequestMessage(
              agent,
              message.senderInboxId,
              messageText,
              replyFn
            );
          } catch (err) {
            console.error('[messageStream] Error processing message:', err);
          }
        },
        onError: (error: any) => {
          console.error('[messageStream] Stream error:', error);
          // Attempt to restart the stream after a delay
          setTimeout(() => {
            console.log('[messageStream] Attempting to restart message stream...');
            streamMessages();
          }, 5000);
        },
      });
    } catch (err) {
      console.error('[messageStream] Failed to start message stream:', err);
      // Attempt to restart the stream after a delay
      setTimeout(() => {
        console.log('[messageStream] Attempting to restart message stream...');
        streamMessages();
      }, 5000);
    }
  };

  streamMessages();
}

// Run the application
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});