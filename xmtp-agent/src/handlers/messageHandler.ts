// Handler for incoming DM messages - processes access requests to group chats
// Users send a chatroom name (e.g., "Mandate-11155111-0xABC...-5") via DM to request access

import type { Agent } from '@xmtp/agent-sdk';
import { IdentifierKind } from '@xmtp/agent-sdk';
import type { Address } from 'viem';
import { recoverMessageAddress } from 'viem';
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

  // Parse optional Abstract Account proof: "chatroomId|smartWalletAddress|eoa_signature"
  // When present, the EOA that owns the XMTP identity signs "${chatroomId}:${smartWalletAddress}"
  // to prove they control the smart wallet holding the on-chain role.
  const parts = trimmed.split('|');
  const chatroomId = parts[0];
  const providedSmartWallet = parts.length === 3 ? (parts[1] as Address) : null;
  const smartWalletSignature = parts.length === 3 ? (parts[2] as `0x${string}`) : null;

  // 1. Try to parse as a chatroom name
  const parsed = parseGroupName(chatroomId);

  if (!parsed) {
    // Not a chatroom name - ignore or reply with help
    await replyFn(
      `I didn't recognize that as a chatroom name. Send a message in the format: Type-chainId-powersAddress-contextId (e.g., Mandate-11155111-0xABC...-5)`
    );
    return;
  }

  const { type, chainId, powersAddress, contextId } = parsed;

  console.log(
    `[messageHandler] Access request from inbox ${senderInboxId} for ${chatroomId}`
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

  // 2b. If a smart wallet proof was provided, verify the EOA signed the claim and use the smart wallet for role checks.
  // This handles Abstract Accounts where the on-chain role is held by the smart wallet, not the EOA.
  let addressToCheck = senderAddress;

  if (providedSmartWallet && smartWalletSignature) {
    const messageToVerify = `${chatroomId}:${providedSmartWallet}`;
    let recoveredAddress: Address;
    try {
      recoveredAddress = await recoverMessageAddress({
        message: messageToVerify,
        signature: smartWalletSignature,
      });
    } catch (err) {
      console.error('[messageHandler] Failed to recover address from signature:', err);
      await replyFn('Invalid smart wallet proof signature. Please try again.');
      return;
    }

    if (recoveredAddress.toLowerCase() !== senderAddress!.toLowerCase()) {
      console.warn(
        `[messageHandler] Signature mismatch: recovered ${recoveredAddress}, expected ${senderAddress}`
      );
      await replyFn(
        'Smart wallet proof signature does not match your XMTP identity. Please try again.'
      );
      return;
    }

    console.log(
      `[messageHandler] Smart wallet proof verified. Using ${providedSmartWallet} for role check instead of EOA ${senderAddress}`
    );
    addressToCheck = providedSmartWallet;
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
    console.log(`[messageHandler] Authorized members for ${chatroomId}:`, authorizedMembers);
  } catch (err) {
    console.error('[messageHandler] Failed to fetch authorized members:', err);
    await replyFn(
      'Failed to check your authorization on-chain. Please try again later.'
    );
    return;
  }

  const isAuthorized = authorizedMembers.some(
    (member) => member.toLowerCase() === addressToCheck!.toLowerCase()
  );

  if (!isAuthorized) {
    console.log(
      `[messageHandler] Address ${addressToCheck} is NOT authorized for ${chatroomId}`
    );
    await replyFn(
      `Your address ${addressToCheck} does not have the required role for this ${type.toLowerCase()} chatroom.`
    );
    return;
  }

  console.log(
    `[messageHandler] Address ${addressToCheck} IS authorized for ${chatroomId}`
  );

  // 4. Find or create the group
  let group = await findGroupByName(agent, chatroomId);
  console.log(`[messageHandler] Fetched group for ${chatroomId}:`, group);

  if (!group) {
    console.log(
      `[messageHandler] Group "${chatroomId}" not found, creating it...`
    );
    try {
      group = await createGroupWithSuperAdminPermissions(agent, chatroomId);

      const welcomeMessage = `Welcome to the ${type} coordination group!\n\nThis group is managed by the Powers XMTP Agent. Members are added automatically when they have the correct role.`;
      await sendMessageToGroup(group, welcomeMessage);

      console.log(`[messageHandler] Group "${chatroomId}" created successfully`);
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
        `[messageHandler] Sender ${senderInboxId} is already in group "${chatroomId}"`
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
      `[messageHandler] Successfully added ${senderAddress} (inbox: ${senderInboxId}) to group "${chatroomId}"`
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