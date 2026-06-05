import { Client, IdentifierKind } from '@xmtp/agent-sdk';
import type { Address } from 'viem';
import type { AgentSession } from '../agent/AgentSession.js';
import { canCallMandate } from '../powers/contract.js';

export function getGroupName(
  type: 'Mandate' | 'Flow' | 'Action',
  chainId: number,
  powersAddress: Address,
  contextId: bigint
): string {
  return `${type}-${chainId}-${powersAddress}-${contextId}`;
}

export function parseGroupName(name: string): {
  type: 'Mandate' | 'Flow' | 'Action';
  chainId: number;
  powersAddress: Address;
  contextId: bigint;
} | null {
  const parts = name.split('-');
  if (parts.length !== 4) return null;
  const [type, chainIdStr, powersAddress, contextIdStr] = parts;
  if (!['Mandate', 'Flow', 'Action'].includes(type)) return null;
  const chainId = parseInt(chainIdStr, 10);
  if (isNaN(chainId)) return null;
  return {
    type: type as 'Mandate' | 'Flow' | 'Action',
    chainId,
    powersAddress: powersAddress as Address,
    contextId: BigInt(contextIdStr),
  };
}

export async function joinGroupIfEligible(
  session: AgentSession,
  groupName: string
): Promise<boolean> {
  if (!session.xmtpClient) return false;

  const parsed = parseGroupName(groupName);
  if (!parsed) return false;

  const { type, chainId, powersAddress, contextId } = parsed;
  if (type !== 'Mandate') return false;

  const eligible = await canCallMandate(
    chainId,
    powersAddress,
    session.userAddress,
    Number(contextId)
  );
  if (!eligible) return false;

  await session.xmtpClient.client.conversations.sync();
  const convos = await session.xmtpClient.client.conversations.list();
  const existing = convos.find((c: any) => c.name === groupName || c.description === groupName);
  if (existing) return true; // already a member

  console.log(`[xmtp] session ${session.sessionId} joining group ${groupName}`);
  // Group joins are initiated by the org bot; agent can join by responding to an invite
  // or by having been added. We sync here and rely on the org bot (xmtp-agent) to add us.
  return false;
}

export async function getSessionGroups(session: AgentSession): Promise<any[]> {
  if (!session.xmtpClient) return [];
  try {
    await session.xmtpClient.client.conversations.sync();
    const convos = await session.xmtpClient.client.conversations.list();
    return convos.filter((c: any) => c.conversationType === 'group');
  } catch (err) {
    console.error(`[xmtp] failed to list groups for session ${session.sessionId}:`, err);
    return [];
  }
}

export async function findGroup(
  session: AgentSession,
  groupName: string
): Promise<any | null> {
  const groups = await getSessionGroups(session);
  return (
    groups.find(
      (g: any) =>
        g.name === groupName ||
        g.groupName === groupName ||
        g.description === groupName
    ) ?? null
  );
}

export async function canAddressReceiveXmtp(address: Address): Promise<boolean> {
  try {
    const map = await Client.canMessage([
      { identifier: address.toLowerCase(), identifierKind: IdentifierKind.Ethereum },
    ]);
    return map.get(address.toLowerCase()) ?? false;
  } catch {
    return false;
  }
}
