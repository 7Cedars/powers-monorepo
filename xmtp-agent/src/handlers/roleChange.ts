// Handler for PowersRoleSet events - ONLY REMOVES members when roles are revoked

import type { Agent } from '@xmtp/agent-sdk';
import type { Address } from 'viem';
import type { PowersRoleSetEvent } from '../utils/types.js';
import { isPowersContract, getAllMandates, getMandatesByRole, getAllActions } from '../powers/contract.js';
import { getFlowsContainingMandates } from '../powers/flows.js';
import { getMandateGroupName, getFlowGroupName, getActionGroupName } from '../utils/naming.js';
import { tryToSendDM, getAllAgentGroups, findGroupByName } from '../groups/management.js';

/**
 * Handles a PowersRoleSet event - ONLY processes role revocations (access = false)
 * 
 * Process:
 * 1. Check if this is a role revocation (access = false)
 * 2. Verify it's a valid Powers contract
 * 3. Try to send DM notification to affected account
 * 4. Get all mandates, flows, and actions with the revoked role
 * 5. For each related group chat, check if the account is a member
 * 6. Remove the account from all relevant groups
 */
export async function handlePowersRoleSet(
  agent: Agent,
  event: PowersRoleSetEvent
): Promise<void> {
  const { roleId, account, access, powersAddress, chainId } = event;
  
  console.log(`Processing PowersRoleSet event:`, {
    roleId: roleId.toString(),
    account,
    access,
    powersAddress,
    chainId,
  });
  
  // ONLY PROCESS ROLE REVOCATIONS
  if (access) {
    console.log(`Role granted event - skipping (role grants are handled via requestAccess API)`);
    return;
  }
  
  try {
    // 1. Verify it's a Powers contract
    const isValid = await isPowersContract(chainId, powersAddress);
    
    if (!isValid) {
      console.log(`Contract ${powersAddress} is not a valid Powers instance, skipping`);
      return;
    }
    
    // 2. Try to send DM notification
    const dmMessage = `Your role ${roleId} has been revoked in the Powers contract at ${powersAddress} on chain ${chainId}. You will be removed from related group chats.`;
    
    const dmSent = await tryToSendDM(agent, account, dmMessage);
    
    if (!dmSent) {
      console.log(`Account ${account} does not have XMTP - no group memberships to update`);
      return;
    }
    
    console.log(`DM sent to ${account}`);
    
    // 3. Get all mandates for this role
    const roleMandates = await getMandatesByRole(chainId, powersAddress, roleId);
    
    if (roleMandates.length === 0) {
      console.log(`No mandates found for role ${roleId}`);
      return;
    }
    
    console.log(`Found ${roleMandates.length} mandates for role ${roleId}`);
    
    // 4. Get all mandates for flow identification
    const allMandates = await getAllMandates(chainId, powersAddress);
    
    // 5. Identify flows containing these mandates
    const flows = getFlowsContainingMandates(allMandates, roleMandates);
    
    console.log(`Found ${flows.length} flows containing role mandates`);
    
    // 6. Get all actions that belong to these mandates
    const allActions = await getAllActions(chainId, powersAddress);
    const relatedActions = allActions.filter(action => 
      roleMandates.some(mandate => mandate.index === BigInt(action.mandateId))
    );
    
    console.log(`Found ${relatedActions.length} actions for role mandates`);
    
    // 7. Build list of group names to check
    const groupNamesToCheck: string[] = [];
    
    // Add mandate groups
    for (const mandate of roleMandates) {
      groupNamesToCheck.push(getMandateGroupName(chainId, powersAddress, mandate.index));
    }
    
    // Add flow groups
    for (const flow of flows) {
      const flowId = flow[0]; // First mandate in flow
      groupNamesToCheck.push(getFlowGroupName(chainId, powersAddress, flowId));
    }
    
    // Add action groups
    for (const action of relatedActions) {
      groupNamesToCheck.push(getActionGroupName(chainId, powersAddress, action.id));
    }
    
    console.log(`Checking ${groupNamesToCheck.length} groups for member removal`);
    
    // 8. Get all agent groups
    const allGroups = await getAllAgentGroups(agent);
    
    // 9. For each group name, find the group and check if account is a member
    for (const groupName of groupNamesToCheck) {
      try {
        // Find matching group (may have timestamp suffix)
        const group = allGroups.find((g: any) => {
          const name = g.name || '';
          const description = g.description || '';
          return name.startsWith(groupName) || description.startsWith(groupName);
        });
        
        if (!group) {
          console.log(`Group ${groupName} not found, skipping`);
          continue;
        }
        
        // Get group members
        let members: any[] = [];
        try {
          if ('members' in group && typeof (group as any).members === 'function') {
            members = await (group as any).members();
          }
        } catch (err) {
          console.error(`Failed to get members for group ${groupName}:`, err);
          continue;
        }
        
        // Get inbox IDs from members
        const inboxIds = members.map((m: any) => m.inboxId).filter(Boolean);
        
        if (inboxIds.length === 0) {
          console.log(`No inbox IDs found for group ${groupName}`);
          continue;
        }
        
        // Fetch inbox states to get Ethereum addresses
        let inboxStates: any[] = [];
        try {
          inboxStates = await agent.client.preferences.fetchInboxStates(inboxIds);
        } catch (err) {
          console.error(`Failed to fetch inbox states for group ${groupName}:`, err);
          continue;
        }
        
        // Find inbox IDs that belong to the revoked account
        const inboxIdsToRemove: string[] = [];
        
        for (const inboxState of inboxStates) {
          // Handle potential mismatch between TS types and runtime
          const identifiers = inboxState.identifiers || (inboxState as any).identities || [];
          
          // Find Ethereum address in identifiers
          const ethIdentifier = identifiers.find((id: any) => 
            id.kind === 'ETHEREUM' || id.identifierKind === 'EthereumIdentifier'
          );
          
          if (ethIdentifier) {
            const inboxAddress = ethIdentifier.identifier as Address;
            
            if (inboxAddress.toLowerCase() === account.toLowerCase()) {
              inboxIdsToRemove.push(inboxState.inboxId);
            }
          }
        }
        
        // Remove the account's inbox IDs from the group
        if (inboxIdsToRemove.length > 0) {
          try {
            await (group as any).removeMembers(inboxIdsToRemove);
            console.log(`Removed ${inboxIdsToRemove.length} inbox(es) for account ${account} from group ${groupName}`);
          } catch (err) {
            console.error(`Failed to remove members from group ${groupName}:`, err);
          }
        } else {
          console.log(`Account ${account} is not a member of group ${groupName}`);
        }
        
      } catch (error) {
        console.error(`Error processing group ${groupName}:`, error);
        // Continue with other groups
      }
    }
    
  } catch (error) {
    console.error('Error handling PowersRoleSet event:', error);
  }
}