// Powers contract interaction utilities

import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import type { Mandate } from '../utils/types.js';
import { config } from '../config/env.js';
import { powersAbi } from './abi.js';

// Chain configurations for Alchemy RPC endpoints
const CHAIN_CONFIGS = {
  11155111: { name: 'sepolia', rpcUrl: config.rpcUrls.sepolia },
  // Future expansion
  // 84532: { name: 'base-sepolia', rpcUrl: config.rpcUrls.baseSepolia },
  // 11155420: { name: 'optimism-sepolia', rpcUrl: config.rpcUrls.optimismSepolia },
  // 421614: { name: 'arbitrum-sepolia', rpcUrl: config.rpcUrls.arbitrumSepolia }
} as const;

type SupportedChainId = keyof typeof CHAIN_CONFIGS;

/**
 * Creates a public client for a specific chain
 */
export function getPublicClient(chainId: number): PublicClient {
  const chainConfig = CHAIN_CONFIGS[chainId as SupportedChainId];
  
  if (!chainConfig) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  
  return createPublicClient({
    transport: http(chainConfig.rpcUrl),
  });
}

/**
 * Verifies that a contract is a valid Powers instance by calling version()
 */
export async function isPowersContract(
  chainId: number,
  contractAddress: Address
): Promise<boolean> {
  try {
    const client = getPublicClient(chainId);
    
    // Try to call version() which should return "v0.5.1" or similar
    const version = await client.readContract({
      address: contractAddress,
      abi: powersAbi,
      functionName: 'version',
    });
    
    // If we get a valid version string starting with "v", it's likely a Powers contract
    return typeof version === 'string' && version.startsWith('v');
  } catch (error) {
    console.error(`Failed to verify Powers contract at ${contractAddress}:`, error);
    return false;
  }
}

/**
 * Gets all mandates from a Powers contract
 */
export async function getAllMandates(
  chainId: number,
  contractAddress: Address
): Promise<Mandate[]> {
  const client = getPublicClient(chainId);
  
  try {
    // Get the mandate counter to know how many mandates exist
    const mandateCounter = await client.readContract({
      address: contractAddress,
      abi: powersAbi,
      functionName: 'getMandateCounter',
    }) as number;
    
    const mandates: Mandate[] = [];
    
    // Fetch each mandate
    for (let i = 1; i <= mandateCounter; i++) {
      try {
        // Get mandate data
        const [mandate, , active] = await client.readContract({
          address: contractAddress,
          abi: powersAbi,
          functionName: 'getAdoptedMandate',
          args: [i],
        }) as [Address, bigint, boolean];
        
        // Get conditions
        const conditions = await client.readContract({
          address: contractAddress,
          abi: powersAbi,
          functionName: 'getConditions',
          args: [i],
        }) as {
          allowedRole: bigint;
          votingPeriod: number;
          timelock: number;
          throttleExecution: number;
          needFulfilled: number;
          needNotFulfilled: number;
          quorum: number;
          succeedAt: number;
        };
        
        mandates.push({
          index: BigInt(i),
          targetMandate: mandate,
          active,
          conditions: {
            allowedRole: conditions.allowedRole,
            votingPeriod: conditions.votingPeriod,
            timelock: BigInt(conditions.timelock),
            throttleExecution: BigInt(conditions.throttleExecution),
            needFulfilled: conditions.needFulfilled !== 0 ? BigInt(conditions.needFulfilled) : 0n,
            needNotFulfilled: conditions.needNotFulfilled !== 0 ? BigInt(conditions.needNotFulfilled) : 0n,
            quorum: conditions.quorum,
            succeedAt: conditions.succeedAt,
          },
        });
      } catch (error) {
        console.error(`Failed to fetch mandate ${i}:`, error);
        // Continue with next mandate
      }
    }
    
    return mandates;
  } catch (error) {
    console.error(`Failed to fetch mandates from ${contractAddress}:`, error);
    return [];
  }
}

/**
 * Gets all mandates that have a specific roleId
 */
export async function getMandatesByRole(
  chainId: number,
  contractAddress: Address,
  roleId: bigint
): Promise<Mandate[]> {
  const allMandates = await getAllMandates(chainId, contractAddress);
  
  return allMandates.filter(
    mandate => mandate.conditions.allowedRole === roleId
  );
}

/**
 * Checks if a specific mandate is active
 */
export async function isMandateActive(
  chainId: number,
  contractAddress: Address,
  mandateId: bigint
): Promise<boolean> {
  const client = getPublicClient(chainId);
  
  try {
    const [, , active] = await client.readContract({
      address: contractAddress,
      abi: powersAbi,
      functionName: 'getAdoptedMandate',
      args: [Number(mandateId)],
    }) as [Address, bigint, boolean];
    
    return active;
  } catch (error) {
    console.error(`Failed to check if mandate ${mandateId} is active:`, error);
    return false;
  }
}

/**
 * Gets all actions from a Powers contract
 */
export async function getAllActions(
  chainId: number,
  contractAddress: Address
): Promise<Array<{ id: bigint; mandateId: number; status: number }>> {
  const client = getPublicClient(chainId);
  
  try {
    // Get the action counter to know how many actions exist
    const actionCounter = await client.readContract({
      address: contractAddress,
      abi: powersAbi,
      functionName: 'getActionCounter',
    }) as bigint;
    
    const actions: Array<{ id: bigint; mandateId: number; status: number }> = [];
    
    // Fetch each action
    for (let i = 0n; i < actionCounter; i++) {
      try {
        const actionData = await client.readContract({
          address: contractAddress,
          abi: powersAbi,
          functionName: 'getActionData',
          args: [i],
        }) as {
          mandateId: number;
          status: number;
        };
        
        actions.push({
          id: i,
          mandateId: actionData.mandateId,
          status: actionData.status,
        });
      } catch (error) {
        console.error(`Failed to fetch action ${i}:`, error);
        // Continue with next action
      }
    }
    
    return actions;
  } catch (error) {
    console.error(`Failed to fetch actions from ${contractAddress}:`, error);
    return [];
  }
}

/**
 * Checks if a specific action is active
 */
export async function isActionActive(
  chainId: number,
  contractAddress: Address,
  actionId: bigint
): Promise<boolean> {
  const client = getPublicClient(chainId);
  
  try {
    const actionData = await client.readContract({
      address: contractAddress,
      abi: powersAbi,
      functionName: 'getActionData',
      args: [actionId],
    }) as {
      status: number;
    };
    
    // Status 1 = Active, 0 = Inactive/Executed/Cancelled
    return actionData.status === 1;
  } catch (error) {
    console.error(`Failed to check if action ${actionId} is active:`, error);
    return false;
  }
}
