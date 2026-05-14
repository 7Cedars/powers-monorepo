// Handler for incoming DM messages - processes access requests to group chats
// Users send a chatroom name (e.g., "Mandate-11155111-0xABC...-5") via DM to request access

import type { Agent } from '@xmtp/agent-sdk';
import { IdentifierKind } from '@xmtp/agent-sdk';
import type { Address } from 'viem';
import { parseGroupName } from '../utils/naming.js';
import {
  findGroupByName,
  createGroupWithSuperAdminPermissions,
  sendMessageToGroup,
} from '../groups/management.js';
import {
  getMandateMembers,
  getFlowMembers,
  getActionMembers,
} from '../powers/members.js';

/**
 * Handles an incoming DM message.
 * If the message text matches a chatroom name format (Type-chainId-powersAddress-contextId),
 * the handler:
 * 1. Resolves the sender's Ethereum address from their inboxId
 * 2. Checks if they have the required role on-chain
 * 3. Finds or creates the group
 * 4. Adds the sender to the group
 * 5. Replies with a confirmation or error
 */
export async function handleAccessRequestMessage(
  agent: Agent,
  senderInboxId: string,
  messageText: string,
  replyFn: (text: string) => Promise<void>
): Promise<void> {
  const trimmed = messageText.trim();

  // 1. Try to parse as a chatroom name
  const parsed = parseGroupName(trimmed);

  if (!parsed) {
    // Not a chatroom name - ignore or reply with help
    await replyFn(
      `I didn't recognize that as a chatroom name. Send a message in the format: Type-chainId-powersAddress-contextId (e.g., Mandate-11155111-0xABC...-5)`
    );
    return;
  }

  const { type, chainId, powersAddress, contextId } = parsed;

  console.log(
    `[messageHandler] Access request from inbox ${senderInboxId} for ${trimmed}`
  );

  // 2. Resolve the sender's Ethereum address from their inboxId
  let senderAddress: Address | null = null;

  try {
    const inboxStates = await agent.client.preferences.fetchInboxStates([
      senderInboxId,
    ]);
    console.log(`[messageHandler] Fetched inbox states for ${senderInboxId}:`, inboxStates);

    if (inboxStates.length === 0) {
      await replyFn('Could not resolve your inbox. Please try again.');
      return;
    }

    const inboxState = inboxStates[0];
    const ethIdentifier =
      inboxState.recoveryIdentifier || (inboxState as any).identities || [];
    console.log(`[messageHandler] Identifiers for inbox ${senderInboxId}:`, ethIdentifier);

    if (!ethIdentifier) {
      await replyFn(
        'No Ethereum address found for your inbox. Please ensure your wallet is linked to your XMTP identity.'
      );
      return;
    }

    senderAddress = ethIdentifier.identifier as Address;
    console.log(
      `[messageHandler] Resolved sender address: ${senderAddress}`
    );
  } catch (err) {
    console.error('[messageHandler] Failed to resolve sender address:', err);
    await replyFn('Failed to verify your identity. Please try again later.');
    return;
  }

  // 3. Check if sender has the required role on-chain
  let authorizedMembers: Address[] = [];

  try {
    if (type === 'Mandate') {
      authorizedMembers = await getMandateMembers(
        chainId,
        powersAddress,
        contextId
      );
    } else if (type === 'Flow') {
      authorizedMembers = await getFlowMembers(
        chainId,
        powersAddress,
        contextId
      );
    } else if (type === 'Action') {
      authorizedMembers = await getActionMembers(
        chainId,
        powersAddress,
        contextId
      );
    }
    console.log(`[messageHandler] Authorized members for ${trimmed}:`, authorizedMembers);
  } catch (err) {
    console.error('[messageHandler] Failed to fetch authorized members:', err);
    await replyFn(
      'Failed to check your authorization on-chain. Please try again later.'
    );
    return;
  }

  const isAuthorized = authorizedMembers.some(
    (member) => member.toLowerCase() === senderAddress!.toLowerCase()
  );

  if (!isAuthorized) {
    console.log(
      `[messageHandler] Address ${senderAddress} is NOT authorized for ${trimmed}`
    );
    await replyFn(
      `Your address ${senderAddress} does not have the required role for this ${type.toLowerCase()} chatroom.`
    );
    return;
  }

  console.log(
    `[messageHandler] Address ${senderAddress} IS authorized for ${trimmed}`
  );

  // 4. Find or create the group
  let group = await findGroupByName(agent, trimmed);
  console.log(`[messageHandler] Fetched group for ${trimmed}:`, group);

  if (!group) {
    console.log(
      `[messageHandler] Group "${trimmed}" not found, creating it...`
    );
    try {
      group = await createGroupWithSuperAdminPermissions(agent, trimmed);

      const welcomeMessage = `Welcome to the ${type} coordination group!\n\nThis group is managed by the Powers XMTP Agent. Members are added automatically when they have the correct role.`;
      await sendMessageToGroup(group, welcomeMessage);

      console.log(`[messageHandler] Group "${trimmed}" created successfully`);
    } catch (err) {
      console.error('[messageHandler] Failed to create group:', err);
      await replyFn('Failed to create the group chat. Please try again later.');
      return;
    }
  }

  // 5. Check if sender is already a member
  try {
    const members = await (group as any).members();
    const alreadyMember = members.some(
      (m: any) => m.inboxId === senderInboxId
    );

    if (alreadyMember) {
      console.log(
        `[messageHandler] Sender ${senderInboxId} is already in group "${trimmed}"`
      );
      await replyFn(
        `You are already a member of the ${type} chatroom. Check your conversations list.`
      );
      return;
    }
  } catch (err) {
    console.error('[messageHandler] Failed to check existing members:', err);
    // Continue anyway - addMembers will fail if already a member
  }

  // 6. Add the sender to the group by Ethereum address identifier
  try {
    await (group as any).addMembersByIdentifiers([{
      identifier: senderAddress!.toLowerCase(),
      identifierKind: IdentifierKind.Ethereum,
    }]);
    console.log(
      `[messageHandler] Successfully added ${senderAddress} (inbox: ${senderInboxId}) to group "${trimmed}"`
    );
    await replyFn(
      `You've been added to the ${type} chatroom! Check your conversations list.`
    );
  } catch (err) {
    console.error('[messageHandler] Failed to add member to group:', err);
    await replyFn(
      'Failed to add you to the group chat. Please try again later.'
    );
  }
}