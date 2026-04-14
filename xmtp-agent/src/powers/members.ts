// Helper functions for getting role holders from Powers contracts

import { type Address } from 'viem';
import { getPublicClient } from './contract.js';
import { powersAbi } from './abi.js';
import { getAllMandates } from './contract.js';
import { identifyFlows } from './flows.js';

/**
 * Gets the PUBLIC_ROLE constant from the Powers contract
 */
async function getPublicRole(
  chainId: number,
  powersAddress: Address
): Promise<bigint> {
  const client = getPublicClient(chainId);
  
  const publicRole = await client.readContract({
    address: powersAddress,
    abi: powersAbi,
    functionName: 'PUBLIC_ROLE',
  }) as bigint;
  
  return publicRole;
}

/**
 * Gets all account addresses that have a specific role
 * Excludes PUBLIC_ROLE automatically
 */
async function getAccountsWithRole(
  chainId: number,
  powersAddress: Address,
  roleId: bigint
): Promise<Address[]> {
  const client = getPublicClient(chainId);
  
  // Get PUBLIC_ROLE to exclude it
  const publicRole = await getPublicRole(chainId, powersAddress);
  
  // Skip if this is the PUBLIC_ROLE
  if (roleId === publicRole) {
    return [];
  }
  
  try {
    // Get the count of role holders
    const count = await client.readContract({
      address: powersAddress,
      abi: powersAbi,
      functionName: 'getAmountRoleHolders',
      args: [roleId],
    }) as bigint;
    
    const accounts: Address[] = [];
    
    // Fetch each role holder
    for (let i = 0; i < Number(count); i++) {
      try {
        const account = await client.readContract({
          address: powersAddress,
          abi: powersAbi,
          functionName: 'getRoleHolderAtIndex',
          args: [roleId, BigInt(i)],
        }) as Address;
        
        accounts.push(account);
      } catch (error) {
        console.error(`Failed to fetch role holder at index ${i}:`, error);
      }
    }
    
    return accounts;
  } catch (error) {
    console.error(`Failed to get accounts with role ${roleId}:`, error);
    return [];
  }
}

/**
 * Gets all unique accounts from multiple role IDs
 * Automatically excludes PUBLIC_ROLE
 */
async function getAccountsWithRoles(
  chainId: number,
  powersAddress: Address,
  roleIds: bigint[]
): Promise<Address[]> {
  const uniqueAccounts = new Set<Address>();
  
  for (const roleId of roleIds) {
    const accounts = await getAccountsWithRole(chainId, powersAddress, roleId);
    accounts.forEach(account => uniqueAccounts.add(account));
  }
  
  return Array.from(uniqueAccounts);
}

/**
 * Gets accounts for a mandate chat (based on mandate's role)
 */
export async function getMandateMembers(
  chainId: number,
  powersAddress: Address,
  mandateId: bigint
): Promise<Address[]> {
  const client = getPublicClient(chainId);
  
  try {
    // Get mandate conditions to extract the role
    const conditions = await client.readContract({
      address: powersAddress,
      abi: powersAbi,
      functionName: 'getConditions',
      args: [Number(mandateId)],
    }) as {
      allowedRole: bigint;
    };
    
    return await getAccountsWithRole(chainId, powersAddress, conditions.allowedRole);
  } catch (error) {
    console.error(`Failed to get mandate members for mandate ${mandateId}:`, error);
    return [];
  }
}

/**
 * Gets accounts for a flow chat (based on all mandates' roles in the flow)
 */
export async function getFlowMembers(
  chainId: number,
  powersAddress: Address,
  flowId: bigint
): Promise<Address[]> {
  try {
    // Get all mandates to identify the flow
    const allMandates = await getAllMandates(chainId, powersAddress);
    
    if (allMandates.length === 0) {
      return [];
    }
    
    // Identify flows
    const flows = identifyFlows(allMandates);
    
    // Find the specific flow
    const flow = flows.find(f => f[0] === flowId);
    
    if (!flow) {
      console.error(`Flow ${flowId} not found`);
      return [];
    }
    
    // Get role IDs for all mandates in the flow
    const roleIds: bigint[] = [];
    
    for (const mandateId of flow) {
      const mandate = allMandates.find(m => m.index === mandateId);
      if (mandate) {
        roleIds.push(mandate.conditions.allowedRole);
      }
    }
    
    // Get all unique accounts with these roles
    return await getAccountsWithRoles(chainId, powersAddress, roleIds);
  } catch (error) {
    console.error(`Failed to get flow members for flow ${flowId}:`, error);
    return [];
  }
}

/**
 * Gets accounts for an action chat (based on the action's mandate role)
 */
export async function getActionMembers(
  chainId: number,
  powersAddress: Address,
  actionId: bigint
): Promise<Address[]> {
  const client = getPublicClient(chainId);
  
  try {
    // Get action data to find the associated mandate
    const actionData = await client.readContract({
      address: powersAddress,
      abi: powersAbi,
      functionName: 'getActionData',
      args: [actionId],
    }) as {
      mandateId: number;
    };
    
    // Get members for this mandate
    return await getMandateMembers(chainId, powersAddress, BigInt(actionData.mandateId));
  } catch (error) {
    console.error(`Failed to get action members for action ${actionId}:`, error);
    return [];
  }
}