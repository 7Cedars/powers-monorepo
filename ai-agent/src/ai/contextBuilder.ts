import type { Address } from 'viem';
import type { AgentSession, OrganisationConfig } from '../agent/AgentSession.js';
import {
  getAllMandates,
  getOpenActions,
  getAgentRoles,
  getCurrentBlock,
  getEthBalance,
  actionStateLabel,
} from '../powers/contract.js';

export interface GovernanceContext {
  triggeredBy: 'xmtp_message' | 'on_chain_event' | 'heartbeat';
  groupName: string;
  groupType: 'Mandate' | 'Flow' | 'Action' | 'unknown';
  contextId: number;
  powersAddress: Address;
  chainId: number;
  agentAddress: Address;
  currentBlock: bigint;
  agentEthBalance: bigint;
  agentRoles: bigint[];
  mandates: Awaited<ReturnType<typeof getAllMandates>>;
  openActions: Awaited<ReturnType<typeof getOpenActions>>;
}

export async function buildContext(
  session: AgentSession,
  org: OrganisationConfig,
  triggeredBy: GovernanceContext['triggeredBy'] = 'xmtp_message',
  groupName = '',
  groupType: GovernanceContext['groupType'] = 'unknown',
  contextId = 0
): Promise<GovernanceContext> {
  const [mandates, openActions, agentRoles, currentBlock, agentEthBalance] =
    await Promise.all([
      getAllMandates(org.chainId, org.powersAddress),
      getOpenActions(org.chainId, org.powersAddress, session.userAddress),
      getAgentRoles(org.chainId, org.powersAddress, session.userAddress),
      getCurrentBlock(org.chainId),
      getEthBalance(org.chainId, session.userAddress),
    ]);

  return {
    triggeredBy,
    groupName,
    groupType,
    contextId,
    powersAddress: org.powersAddress,
    chainId: org.chainId,
    agentAddress: session.userAddress,
    currentBlock,
    agentEthBalance,
    agentRoles,
    mandates,
    openActions,
  };
}

export function formatContextMessage(ctx: GovernanceContext): string {
  const ethBalanceFormatted = (
    Number(ctx.agentEthBalance) / 1e18
  ).toFixed(6);

  const mandateLines = ctx.mandates
    .filter((m) => m.active)
    .map((m) => {
      const canCall = ctx.agentRoles.includes(m.conditions.allowedRole);
      return [
        `  [${m.mandateId}] ${m.mandateId} — role ${m.conditions.allowedRole}`,
        `    Active: ${m.active} | Can call: ${canCall}`,
        `    Quorum: ${m.conditions.quorum}% | Pass: ${m.conditions.succeedAt}%`,
        `    Voting: ${m.conditions.votingPeriod} blocks | Timelock: ${m.conditions.timelock} blocks`,
      ].join('\n');
    })
    .join('\n\n');

  const actionLines = ctx.openActions
    .map((a) => {
      const stateLabel = actionStateLabel(a.state);
      return [
        `  ActionId=${a.actionId} | Mandate=${a.mandateId} | State=${stateLabel}`,
        `  Votes: FOR=${a.forVotes} AGAINST=${a.againstVotes} ABSTAIN=${a.abstainVotes}`,
        `  Vote window: block ${a.voteStart}–${a.voteEnd}`,
        `  Executable after block: ${a.readyToExecuteAt}`,
        `  You have voted: ${a.hasAgentVoted}`,
      ].join('\n');
    })
    .join('\n\n');

  return [
    '=== GOVERNANCE STATE ===',
    `Trigger: ${ctx.triggeredBy}${ctx.groupName ? ` in ${ctx.groupName} (${ctx.groupType} #${ctx.contextId})` : ''}`,
    `Organisation: ${ctx.powersAddress} (chain ${ctx.chainId})`,
    `Your address: ${ctx.agentAddress}`,
    `Your roles: ${ctx.agentRoles.length ? ctx.agentRoles.join(', ') : 'none'}`,
    `Your ETH balance: ${ethBalanceFormatted} ETH`,
    `Current block: ${ctx.currentBlock}`,
    '',
    'ACTIVE MANDATES YOU CAN CALL:',
    mandateLines || '  (none)',
    '',
    'OPEN ACTIONS IN SCOPE:',
    actionLines || '  (none)',
    '=== END STATE ===',
  ].join('\n');
}
