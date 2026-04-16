// Viem-based event watcher for RoleSet events

import { type Address, type WatchContractEventReturnType } from 'viem';
import { getPublicClient } from '../powers/contract.js';
import { powersAbi } from '../powers/abi.js';
import type { RoleSetEvent } from '../utils/types.js';

type EventHandler = (event: RoleSetEvent) => Promise<void>;

/**
 * Watches for RoleSet events on a specific chain and Powers contract
 * 
 * @param chainId - The chain ID to watch
 * @param powersAddress - The Powers contract address to watch
 * @param onEvent - Callback function to handle each event
 * @returns Unwatch function to stop watching
 */
export function watchRoleSetEvents(
  chainId: number,
  powersAddress: Address,
  onEvent: EventHandler
): WatchContractEventReturnType {
  const client = getPublicClient(chainId);
  
  console.log(`Starting to watch RoleSet events on chain ${chainId} for contract ${powersAddress}`);
  
  const unwatch = client.watchContractEvent({
    address: powersAddress,
    abi: powersAbi,
    eventName: 'RoleSet',
    onLogs: async (logs) => {
      for (const log of logs) {
        try {
          console.log(`Received log for RoleSet event:`, log);
          // Skip if missing required data
          if (!log.blockNumber || !log.transactionHash) {
            console.warn('Skipping log with missing blockNumber or transactionHash');
            continue;
          }
          
          // Extract event data
          // topics[0] = event signature
          // topics[1] = roleId (indexed)
          // topics[2] = account (indexed)
          // topics[3] = access (indexed)
          const roleId = BigInt(log.topics[1] as string);
          const accountHex = log.topics[2] as string;
          const account = ('0x' + accountHex.slice(26)) as Address; // Remove padding
          const access = (log.topics[3] as string) === '0x0000000000000000000000000000000000000000000000000000000000000001';
          
          const event: RoleSetEvent = {
            roleId,
            account,
            access,
            powersAddress,
            chainId,
            blockNumber: log.blockNumber,
            transactionHash: log.transactionHash,
          };
          
          console.log(`RoleSet event detected:`, {
            roleId: roleId.toString(),
            account,
            access,
            blockNumber: log.blockNumber.toString(),
          });
          
          // Call the event handler
          await onEvent(event);
        } catch (error) {
          console.error('Error processing RoleSet log:', error);
        }
      }
    },
    onError: (error) => {
      console.error('Error watching RoleSet events:', error);
    },
  });
  
  return unwatch;
}

/**
 * Watches for RoleSet events on multiple Powers contracts
 * 
 * @param chainId - The chain ID to watch
 * @param powersAddresses - Array of Powers contract addresses to watch
 * @param onEvent - Callback function to handle each event
 * @returns Array of unwatch functions
 */
export function watchMultiplePowersContracts(
  chainId: number,
  powersAddresses: Address[],
  onEvent: EventHandler
): WatchContractEventReturnType[] {
  return powersAddresses.map(address => 
    watchRoleSetEvents(chainId, address, onEvent)
  );
}