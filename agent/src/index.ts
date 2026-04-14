// Main entry point for the XMTP Powers Agent
// This file initializes the agent, starts event watchers, and launches the API server

import { initializeAgent } from './agent.js';
import { watchPowersRoleSetEvents } from './watchers/powersRoleSet.js';
import { handlePowersRoleSet } from './handlers/roleChange.js';
import { createServer, startServer } from './api/server.js'; 
import { config } from './config/env.js';
import type { Address } from 'viem';
import type { WatchContractEventReturnType } from 'viem';

// Configuration for Powers contracts to watch
// TODO: Make this configurable via environment or database
const CONTRACTS_TO_WATCH = [
  {
    chainId: 11155111, // Sepolia
    powersAddress: '0x1234567890123456789012345678901234567890' as Address, // Update with actual address
  },
  // Add more contracts as needed
];

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
    
    for (const contract of CONTRACTS_TO_WATCH) {
      console.log(`  Watching chain ${contract.chainId}, contract ${contract.powersAddress}`);
      
      const unwatch = watchPowersRoleSetEvents(
        contract.chainId,
        contract.powersAddress,
        async (event) => {
          // Handle the event
          await handlePowersRoleSet(agent, event);
        }
      );
      
      unwatchFunctions.push(unwatch);
    }
    
    console.log('✓ Event watchers started');
    console.log('');
    
    // 3. Create and start the API server
    console.log('Starting API server...');
    const app = createServer(agent);
    startServer(app);
    console.log('✓ API server started');
    console.log('');
    
    console.log('='.repeat(50));
    console.log('Powers XMTP Agent is running');
    console.log('='.repeat(50));
    console.log('');
    
    // 4. Set up graceful shutdown
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

// Run the application
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});