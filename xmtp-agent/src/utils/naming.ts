// Group naming utilities - matches bot/lib/utils/naming.ts

import type { Address } from 'viem';

/**
 * Generates a mandate group name
 * Format: Mandate-{chainId}-{powersAddress}-{mandateId}
 */
export function getMandateGroupName(
  chainId: number,
  powersAddress: Address,
  mandateId: bigint
): string {
  return `Mandate-${chainId}-${powersAddress}-${mandateId}`;
}

/**
 * Generates a flow group name
 * Format: Flow-{chainId}-{powersAddress}-{flowId}
 * where flowId is the first mandate ID in the flow (sorted numerically)
 */
export function getFlowGroupName(
  chainId: number,
  powersAddress: Address,
  flowId: bigint
): string {
  return `Flow-${chainId}-${powersAddress}-${flowId}`;
}

/**
 * Generates an action group name
 * Format: Action-{chainId}-{powersAddress}-{actionId}
 */
export function getActionGroupName(
  chainId: number,
  powersAddress: Address,
  actionId: bigint
): string {
  return `Action-${chainId}-${powersAddress}-${actionId}`;
}

/**
 * Parses a group name to extract its type and IDs
 * Returns null if the name doesn't match the expected format
 */
export function parseGroupName(groupName: string): {
  type: 'Mandate' | 'Flow' | 'Action';
  chainId: number;
  powersAddress: Address;
  contextId: bigint;
} | null {
  const parts = groupName.split('-');
  
  if (parts.length !== 4) {
    return null;
  }
  
  const [type, chainIdStr, powersAddress, contextIdStr] = parts;
  
  if (!['Mandate', 'Flow', 'Action'].includes(type)) {
    return null;
  }
  
  const chainId = parseInt(chainIdStr, 10);
  const contextId = BigInt(contextIdStr);
  
  if (isNaN(chainId)) {
    return null;
  }
  
  return {
    type: type as 'Mandate' | 'Flow' | 'Action',
    chainId,
    powersAddress: powersAddress as Address,
    contextId,
  };
}