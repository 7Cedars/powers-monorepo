// Powers contract interaction utilities

import { createPublicClient, http, type Address, type PublicClient } from 'viem';
import type { Mandate } from '../types.js';
import { config } from '../../config/env.js';
import { powersAbi } from './abi.js';

// Chain configurations for Alchemy RPC endpoints
// Using the config structure from env.ts which has alchemyApiKeys and rpcUrls
const CHAIN_CONFIGS = {
  11155111: { name: 'sepolia', rpcUrl: config.rpcUrls.sepolia },
  84532: { name: 'base-sepolia', rpcUrl: config.rpcUrls.baseSepolia },
  11155420: { name: 'optimism-sepolia', rpcUrl: config.rpcUrls.optimismSepolia },
  421614: { name: 'arbitrum-sepolia', rpcUrl: config.rpcUrls.arbitrumSepolia }
} as const;

type SupportedChainId = keyof typeof CHAIN_CONFIGS;

/**
 * Creates a public client for a specific chain
 */
function getPublicClient(chainId: number): PublicClient {
  const config = CHAIN_CONFIGS[chainId as SupportedChainId];
  
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }
  
  return createPublicClient({
    transport: http(config.rpcUrl),
  });
}

/**
 * Verifies that a contract is a valid Powers instance by calling version()
 * @param chainId The chain ID where the contract is deployed
 * @param contractAddress The address of the contract to verify
 * @returns True if the contract is a Powers instance, false otherwise
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
 * @param chainId The chain ID where the contract is deployed
 * @param contractAddress The address of the Powers contract
 * @returns Array of all mandates
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
 * @param chainId The chain ID where the contract is deployed
 * @param contractAddress The address of the Powers contract
 * @param roleId The role ID to filter by
 * @returns Array of mandates with the specified role
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