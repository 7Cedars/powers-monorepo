// Handler for PowersRoleSet events

import type { Agent } from '@xmtp/agent-sdk';
import type { Address } from 'viem';
import type { PowersRoleSetEvent, GroupOperation } from '../utils/types.js';
import { isPowersContract, getAllMandates, getMandatesByRole } from '../powers/contract.js';
import { getFlowsContainingMandates } from '../powers/flows.js';
import { getMandateGroupName, getFlowGroupName, getActionGroupName } from '../utils/naming.js';
import { tryToSendDM, executeBatchGroupOperations } from '../groups/management.js';

/**
 * Handles a PowersRoleSet event
 * 
 * Process:
 * 1. Verify it's a valid Powers contract
 * 2. Try to send DM notification to affected account
 * 3. Get all mandates with the assigned/revoked role
 * 4. Identify flows containing those mandates
 * 5. Build list of group operations (add/remove from mandate and flow groups)
 * 6. Execute batch operations (which will check if groups are still active)
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
  
  try {
    // 1. Verify it's a Powers contract
    const isValid = await isPowersContract(chainId, powersAddress);
    
    if (!isValid) {
      console.log(`Contract ${powersAddress} is not a valid Powers instance, skipping`);
      return;
    }
    
    // 2. Try to send DM notification
    const dmMessage = access
      ? `You have been granted role ${roleId} in the Powers contract at ${powersAddress} on chain ${chainId}.`
      : `Your role ${roleId} has been revoked in the Powers contract at ${powersAddress} on chain ${chainId}.`;
    
    const dmSent = await tryToSendDM(agent, account, dmMessage);
    
    if (!dmSent) {
      console.log(`Account ${account} does not have XMTP - skipping group membership updates`);
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
    
    // 6. Build list of group operations
    const operations: GroupOperation[] = [];
    
    // Add operations for each mandate group
    for (const mandate of roleMandates) {
      operations.push({
        groupName: getMandateGroupName(chainId, powersAddress, mandate.index),
        account,
        action: access ? 'add' : 'remove',
      });
    }
    
    // Add operations for each flow group
    for (const flow of flows) {
      const flowId = flow[0]; // First mandate in flow
      operations.push({
        groupName: getFlowGroupName(chainId, powersAddress, flowId),
        account,
        action: access ? 'add' : 'remove',
      });
    }
    
    console.log(`Executing ${operations.length} group operations`);
    
    // 7. Execute all operations in batch
    // This will automatically check if each group is still active before processing
    await executeBatchGroupOperations(agent, operations);
    
  } catch (error) {
    console.error('Error handling PowersRoleSet event:', error);
  }
}