// XMTP group management using Agent SDK

import type { Agent } from '@xmtp/agent-sdk';
import { Client, IdentifierKind } from '@xmtp/agent-sdk';
import type { Address } from 'viem';
import type { GroupOperation } from '../utils/types.js';
import { isMandateActive, isActionActive } from '../powers/contract.js';
import { parseGroupName } from '../utils/naming.js';
import { saveGroupMapping, getGroupConversationId } from './groupStore.js';

/**
 * Checks if a group should still be active based on its name and contract state
 * 
 * For Flow groups: Only check if the mandate ID mentioned in the flow name is active
 * For Mandate groups: Check if that specific mandate is active
 * For Action groups: Check if that specific action is active
 */
export async function isGroupActive(groupName: string): Promise<boolean> {
  const parsed = parseGroupName(groupName);
  
  if (!parsed) {
    console.warn(`Could not parse group name: ${groupName}`);
    return false;
  }
  
  const { type, chainId, powersAddress, contextId } = parsed;
  
  try {
    if (type === 'Flow') {
      // For flows, only check if the mandate mentioned in the name is active
      // (the first mandate ID in the flow)
      return await isMandateActive(chainId, powersAddress, contextId);
    } else if (type === 'Mandate') {
      // Check if the specific mandate is active
      return await isMandateActive(chainId, powersAddress, contextId);
    } else if (type === 'Action') {
      // Check if the specific action is active
      return await isActionActive(chainId, powersAddress, contextId);
    }
    
    return false;
  } catch (error) {
    console.error(`Failed to check if group ${groupName} is active:`, error);
    return false;
  }
}

/**
 * Gets all groups that the agent is a member of
 */
export async function getAllAgentGroups(agent: Agent): Promise<any[]> {
  try {
    await agent.client.conversations.sync();
    const conversations = await agent.client.conversations.list();
    
    // Filter for group conversations
    const groups = conversations.filter((c: any) => c.conversationType === 'group');
    
    return groups;
  } catch (error) {
    console.error('Failed to get agent groups:', error);
    return [];
  }
}

/**
 * Finds a group by name, using the persistent store for reliable lookup
 */
export async function findGroupByName(agent: Agent, groupName: string): Promise<any | null> {
  try {
    // First, check the persistent store for a known conversationId
    const storedConversationId = getGroupConversationId(groupName);
    
    if (storedConversationId) {
      console.log(`[findGroupByName] Found stored conversationId for "${groupName}": ${storedConversationId}`);
      
      // Sync and look up by conversationId
      await agent.client.conversations.sync();
      const allConvos = await agent.client.conversations.list();
      const group = allConvos.find((c: any) => c.id === storedConversationId);
      
      if (group) {
        return group;
      }
      
      console.warn(`[findGroupByName] Stored conversationId ${storedConversationId} not found in conversations list, falling back to name search`);
    }
    
    // Fallback: search by name (for groups created before the store existed)
    const groups = await getAllAgentGroups(agent);
    const group = groups.find((g: any) => 
      g.name === groupName || g.description === groupName
    );
    
    // If found by name fallback, save the mapping for future lookups
    if (group) {
      console.log(`[findGroupByName] Found group by name fallback, saving mapping`);
      saveGroupMapping(groupName, group.id);
    }
    
    return group || null;
  } catch (error) {
    console.error(`Failed to find group ${groupName}:`, error);
    return null;
  }
}

/**
 * Creates a group with super admin-only permissions
 * Saves the groupName → conversationId mapping to the persistent store
 */
export async function createGroupWithSuperAdminPermissions(
  agent: Agent,
  groupName: string
): Promise<any> {
  console.log(`Creating group: ${groupName}`);
  
  try {
    // Create group (agent is automatically super admin)
    const group = await agent.client.conversations.createGroup([], {
      groupName,
      groupDescription: groupName,
    });
    
    // Save the mapping to persistent store
    saveGroupMapping(groupName, group.id);
    
    console.log(`Group created: ${groupName} (conversationId: ${group.id})`);
    
    return group;
  } catch (error) {
    console.error(`Failed to create group ${groupName}:`, error);
    throw error;
  }
}

/**
 * Adds members to a group by their Ethereum addresses
 */
export async function addMembersToGroup(
  agent: Agent,
  group: any,
  addresses: Address[]
): Promise<void> {
  if (addresses.length === 0) {
    return;
  }
  
  console.log(`Adding ${addresses.length} members to group ${group.name}`);
  
  // First, filter addresses to only include those that can receive messages
  const validAddresses: Address[] = [];
  
  for (const address of addresses) {
    try {
      // Check if account can receive messages
      const canMessageMap = await Client.canMessage([{
        identifier: address.toLowerCase(),
        identifierKind: IdentifierKind.Ethereum,
      }]);
      
      if (!canMessageMap.get(address.toLowerCase())) {
        console.log(`Account ${address} cannot receive XMTP messages, skipping`);
        continue;
      }
      
      validAddresses.push(address);
    } catch (error) {
      console.error(`Failed to check if ${address} can message:`, error);
      // Continue with other members
    }
  }
  
  // Batch add all valid members at once
  if (validAddresses.length > 0) {
    try {
      const identifiers = validAddresses.map(address => ({
        identifier: address.toLowerCase(),
        identifierKind: IdentifierKind.Ethereum,
      }));
      
      await group.addMembersByIdentifiers(identifiers);
      console.log(`Successfully added ${validAddresses.length} members to ${group.name}`);
    } catch (error: any) {
      // Handle the case where addresses don't have registered XMTP identities
      if (error?.code === 'GenericFailure' && error?.message?.includes('AddressNotFound')) {
        console.warn(`Some addresses don't have registered XMTP identities yet:`, validAddresses);
        console.warn(`These users will need to create XMTP identities before they can join the group`);
        // Don't throw - this is expected behavior for addresses without XMTP
      } else {
        console.error(`Failed to add members to group:`, error);
        throw error;
      }
    }
  } else {
    console.log(`No valid addresses to add to ${group.name}`);
  }
}

/**
 * Removes members from a group by their Ethereum addresses
 */
export async function removeMembersFromGroup(
  agent: Agent,
  group: any,
  addresses: Address[]
): Promise<void> {
  if (addresses.length === 0) {
    return;
  }
  
  console.log(`Removing ${addresses.length} members from group ${group.name}`);
  
  try {
    // Batch remove all members at once
    const identifiers = addresses.map(address => ({
      identifier: address.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }));
    
    await group.removeMembersByIdentifiers(identifiers);
    console.log(`Successfully removed ${addresses.length} members from ${group.name}`);
  } catch (error) {
    console.error(`Failed to remove members from group:`, error);
    throw error;
  }
}

/**
 * Executes batch group operations (add/remove members)
 * Only processes operations for groups that are still active
 */
export async function executeBatchGroupOperations(
  agent: Agent,
  operations: GroupOperation[]
): Promise<void> {
  if (operations.length === 0) {
    return;
  }
  
  console.log(`Executing ${operations.length} group operations...`);
  
  // Group operations by group name for efficiency
  const groupedOps = new Map<string, GroupOperation[]>();
  
  for (const op of operations) {
    if (!groupedOps.has(op.groupName)) {
      groupedOps.set(op.groupName, []);
    }
    groupedOps.get(op.groupName)!.push(op);
  }
  
  // Execute operations group by group
  for (const [groupName, ops] of groupedOps) {
    try {
      // Check if group is still active
      const active = await isGroupActive(groupName);
      
      if (!active) {
        console.log(`Group ${groupName} is no longer active, skipping operations`);
        continue;
      }
      
      // Find the group
      const group = await findGroupByName(agent, groupName);
      
      if (!group) {
        console.log(`Group ${groupName} not found, skipping operations`);
        continue;
      }
      
      // Separate add and remove operations
      const toAdd = ops.filter(op => op.action === 'add').map(op => op.account as Address);
      const toRemove = ops.filter(op => op.action === 'remove').map(op => op.account as Address);
      
      // Execute additions
      if (toAdd.length > 0) {
        await addMembersToGroup(agent, group, toAdd);
      }
      
      // Execute removals
      if (toRemove.length > 0) {
        await removeMembersFromGroup(agent, group, toRemove);
      }
      
      // Sync the group after operations
      await group.sync();
      
    } catch (error) {
      console.error(`Failed to execute operations for group ${groupName}:`, error);
      // Continue with other groups even if one fails
    }
  }
  
  console.log(`Completed batch group operations`);
}

/**
 * Sends a message to a group
 */
export async function sendMessageToGroup(group: any, message: string): Promise<void> {
  try {
    await group.sendText(message);
    console.log(`Message sent to group ${group.name}`);
  } catch (error) {
    console.error(`Failed to send message to group ${group.name}:`, error);
    throw error;
  }
}

/**
 * Tries to send a DM to an Ethereum address
 * Returns true if successful, false if account doesn't have XMTP
 */
export async function tryToSendDM(agent: Agent, account: Address, message: string): Promise<boolean> {
  try {
    // Check if account can message
    const canMessageMap = await Client.canMessage([{
      identifier: account.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }]);
    
    if (!canMessageMap.get(account.toLowerCase())) {
      console.log(`Account ${account} cannot receive XMTP messages`);
      return false;
    }
    
    // If message is empty, just return true (used for checking if can message)
    if (!message) {
      return true;
    }
    
    // Create or get DM conversation using identity object
    const dm = await agent.client.conversations.createDm(account.toLowerCase());
    
    // Send message
    await dm.sendText(message);
    console.log(`DM sent to ${account}`);
    
    return true;
  } catch (error) {
    console.error(`Failed to send DM to ${account}:`, error);
    return false;
  }
}
