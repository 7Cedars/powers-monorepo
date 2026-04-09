// XMTP Group management functions

import { IdentifierKind } from '@xmtp/node-sdk';
import type { GroupOperation } from '../types.js';
import { getXMTPClient } from './client.js';

/**
 * Creates a group with super admin-only permissions
 * @param groupName The name for the group
 * @returns The created group conversation
 */
export async function createGroupWithSuperAdminPermissions(groupName: string) {
  const client = await getXMTPClient();
  
  console.log(`Creating group: ${groupName}`);
  
  // Create group with super admin permissions
  // The creator (bot) is automatically the super admin
  const group = await client.conversations.createGroup([]) as any;
  
  // Set group name and description after creation
  try {
    await group.updateName(groupName);
    await group.updateDescription(groupName);
  } catch (error) {
    console.warn('Failed to set group metadata:', error);
  }
  
  console.log(`Group created: ${groupName} (ID: ${group.id})`);
  
  return group;
}

/**
 * Checks if the bot is already a member of a group with the given name
 * @param groupName The name of the group to check
 * @returns True if bot is a member, false otherwise
 */
export async function isBotMemberOfGroup(groupName: string): Promise<boolean> {
  const client = await getXMTPClient();
  
  try {
    await client.conversations.sync();
    const allConvos = await client.conversations.list();
    
    // Filter for group conversations
    const groupConvos = allConvos.filter((c: any) => 
      'addMembers' in c || c.conversationType === 'group'
    );
    
    // Check if group with this name exists and bot is member
    const matchingGroup = groupConvos.find((c: any) => 
      c.name === groupName || c.description === groupName
    );
    
    return !!matchingGroup;
  } catch (error) {
    console.error(`Error checking group membership for ${groupName}:`, error);
    return false;
  }
}

/**
 * Finds a group by name
 * @param groupName The name of the group to find
 * @returns The group conversation or null if not found
 */
export async function findGroupByName(groupName: string) {
  const client = await getXMTPClient();
  
  try {
    await client.conversations.sync();
    const allConvos = await client.conversations.list();
    
    // Filter for group conversations
    const groupConvos = allConvos.filter((c: any) => 
      'addMembers' in c || c.conversationType === 'group'
    );
    
    // Find matching group
    const matchingGroup = groupConvos.find((c: any) => 
      c.name === groupName || c.description === groupName
    );
    
    return matchingGroup || null;
  } catch (error) {
    console.error(`Error finding group ${groupName}:`, error);
    return null;
  }
}

/**
 * Sends a text message to a group
 * @param group The group conversation
 * @param message The message to send
 */
export async function sendMessageToGroup(group: any, message: string): Promise<void> {
  try {
    await group.send(message);
    console.log(`Message sent to group ${group.name}: ${message}`);
  } catch (error) {
    console.error(`Failed to send message to group ${group.name}:`, error);
    throw error;
  }
}

/**
 * Tries to send a DM to an Ethereum address
 * @param account The Ethereum address to send to
 * @param message The message to send
 * @returns True if successful, false if account doesn't have XMTP
 */
export async function tryToSendDM(account: string, message: string): Promise<boolean> {
  const client = await getXMTPClient();
  
  try {
    // Check if account can message
    const canMessageMap = await client.canMessage([{
      identifier: account,
      identifierKind: IdentifierKind.Ethereum
    }]);
    
    const canMessage = canMessageMap.get(account);
    
    if (!canMessage) {
      console.log(`Account ${account} cannot receive XMTP messages`);
      return false;
    }
    
    // Create or fetch DM using the correct Node SDK API
    const dm = await (client.conversations as any).fetchDmByIdentifier({
      identifier: account,
      identifierKind: IdentifierKind.Ethereum
    });
    
    if (!dm) {
      console.log(`Could not create DM with ${account}`);
      return false;
    }
    
    // Send message
    await dm.send(message);
    console.log(`DM sent to ${account}: ${message}`);
    
    return true;
  } catch (error) {
    console.error(`Failed to send DM to ${account}:`, error);
    return false;
  }
}

/**
 * Gets the inbox ID for an Ethereum address
 * @param account The Ethereum address
 * @returns The inbox ID or null if not found
 */
async function getInboxIdForAccount(account: string): Promise<string | null> {
  const client = await getXMTPClient();
  
  try {
    // Check if account can message
    const canMessageMap = await client.canMessage([{
      identifier: account,
      identifierKind: IdentifierKind.Ethereum
    }]);
    
    if (!canMessageMap.get(account)) {
      return null;
    }
    
    // Create/fetch DM to get inbox ID
    const dm = await (client.conversations as any).fetchDmByIdentifier({
      identifier: account,
      identifierKind: IdentifierKind.Ethereum
    });
    
    if (!dm) {
      return null;
    }
    
    // Get members to find the peer's inbox ID
    const members = await (dm as any).members();
    const peerMember = members.find((m: any) => m.inboxId !== client.inboxId);
    
    return peerMember?.inboxId || null;
  } catch (error) {
    console.error(`Failed to get inbox ID for ${account}:`, error);
    return null;
  }
}

/**
 * Gets inbox IDs for multiple Ethereum addresses
 * @param accounts Array of Ethereum addresses
 * @returns Map of address to inbox ID
 */
async function getInboxIdsForAccounts(accounts: string[]): Promise<Map<string, string>> {
  const inboxIds = new Map<string, string>();
  
  for (const account of accounts) {
    const inboxId = await getInboxIdForAccount(account);
    if (inboxId) {
      inboxIds.set(account, inboxId);
    }
  }
  
  return inboxIds;
}

/**
 * Executes batch group operations (add/remove members)
 * @param operations Array of group operations to perform
 */
export async function executeBatchGroupOperations(operations: GroupOperation[]): Promise<void> {
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
      const group = await findGroupByName(groupName);
      
      if (!group) {
        console.log(`Group ${groupName} not found, skipping operations`);
        continue;
      }
      
      // Separate add and remove operations
      const toAdd = ops.filter(op => op.action === 'add').map(op => op.account);
      const toRemove = ops.filter(op => op.action === 'remove').map(op => op.account);
      
      // Get inbox IDs for accounts
      if (toAdd.length > 0) {
        console.log(`Adding ${toAdd.length} members to ${groupName}...`);
        const inboxIds = await getInboxIdsForAccounts(toAdd);
        
        if (inboxIds.size > 0) {
          await (group as any).addMembers(Array.from(inboxIds.values()));
          console.log(`Successfully added ${inboxIds.size} members to ${groupName}`);
        } else {
          console.log(`No valid inbox IDs found for adding to ${groupName}`);
        }
      }
      
      if (toRemove.length > 0) {
        console.log(`Removing ${toRemove.length} members from ${groupName}...`);
        const inboxIds = await getInboxIdsForAccounts(toRemove);
        
        if (inboxIds.size > 0) {
          await (group as any).removeMembers(Array.from(inboxIds.values()));
          console.log(`Successfully removed ${inboxIds.size} members from ${groupName}`);
        } else {
          console.log(`No valid inbox IDs found for removing from ${groupName}`);
        }
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