// XMTP Agent initialization using Agent SDK

import { Agent } from '@xmtp/agent-sdk';
import { config } from './config/env.js';

let agentInstance: Agent | null = null;

/**
 * Initializes the XMTP agent using Agent.createFromEnv()
 * This handles:
 * - Reading XMTP_WALLET_KEY, XMTP_DB_ENCRYPTION_KEY, XMTP_ENV from environment
 * - Creating the local database directory if needed
 * - Setting up the XMTP client with proper authentication
 * - Registering the agent's identity on the XMTP network (if first time)
 */
export async function initializeAgent(): Promise<Agent> {
  if (agentInstance) {
    console.log('Agent already initialized, returning existing instance');
    return agentInstance;
  }

  console.log('Initializing XMTP Agent...');
  
  try {
    // Use Agent.createFromEnv() which automatically handles environment variables
    // It reads XMTP_WALLET_KEY, XMTP_DB_ENCRYPTION_KEY, XMTP_DB_DIRECTORY, and XMTP_ENV
    const agent = await Agent.createFromEnv();
    
    agentInstance = agent;
    
    console.log('XMTP Agent initialized successfully');
    console.log('Agent address:', agent.address);
    
    return agent;
  } catch (error) {
    console.error('Failed to initialize XMTP agent:', error);
    throw error;
  }
}

/**
 * Gets the current agent instance
 * Throws an error if agent hasn't been initialized
 */
export function getAgent(): Agent {
  if (!agentInstance) {
    throw new Error('Agent not initialized. Call initializeAgent() first.');
  }
  return agentInstance;
}

/**
 * Resets the agent instance (useful for testing)
 */
export function resetAgent(): void {
  agentInstance = null;
}