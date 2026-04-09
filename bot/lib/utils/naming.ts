// Group naming utilities following the same convention as frontend

/**
 * Creates a group name for a mandate
 * @param chainId The chain ID
 * @param powersAddress The Powers contract address
 * @param mandateId The mandate ID
 * @returns The group name following convention: Mandate-{chainId}-{powersAddress}-{mandateId}
 */
export function getMandateGroupName(
  chainId: number | string,
  powersAddress: string,
  mandateId: bigint | string
): string {
  return `Mandate-${chainId}-${powersAddress}-${mandateId}`;
}

/**
 * Creates a group name for a flow
 * @param chainId The chain ID
 * @param powersAddress The Powers contract address
 * @param flowId The flow identifier (typically the first mandate ID in the flow)
 * @returns The group name following convention: Flow-{chainId}-{powersAddress}-{flowId}
 */
export function getFlowGroupName(
  chainId: number | string,
  powersAddress: string,
  flowId: bigint | string
): string {
  return `Flow-${chainId}-${powersAddress}-${flowId}`;
}

/**
 * Parses a group name to extract its components
 * @param groupName The group name to parse
 * @returns Object with type, chainId, powersAddress, and contextId, or null if invalid
 */
export function parseGroupName(groupName: string): {
  type: 'Mandate' | 'Flow';
  chainId: string;
  powersAddress: string;
  contextId: string;
} | null {
  const parts = groupName.split('-');
  
  if (parts.length !== 4) {
    return null;
  }
  
  const [type, chainId, powersAddress, contextId] = parts;
  
  if (type !== 'Mandate' && type !== 'Flow') {
    return null;
  }
  
  return {
    type: type as 'Mandate' | 'Flow',
    chainId,
    powersAddress,
    contextId,
  };
}