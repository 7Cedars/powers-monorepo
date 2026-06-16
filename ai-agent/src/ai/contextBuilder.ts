import type { Address } from 'viem';
import type { AgentSession, OrganisationConfig } from '../agent/AgentSession.js';
import {
  getAllMandates,
  getOpenActions,
  getAgentRoles,
  getCurrentBlock,
  getEthBalance,
  getOrgName,
  getOrgUri,
  getAllRoleInfo,
  actionStateLabel,
  type RoleInfo,
  type HistoricalAction,
} from '../powers/contract.js';
import { formatLinkedInstancesSummary } from '../powers/linkedInstances.js';

export interface GovernanceContext {
  triggeredBy: 'xmtp_message' | 'on_chain_event' | 'heartbeat';
  groupName: string;
  groupType: 'Mandate' | 'Flow' | 'Action' | 'unknown';
  contextId: number;
  powersAddress: Address;
  chainId: number;
  orgName: string;
  orgUri: string;
  agentAddress: Address;
  currentBlock: bigint;
  agentEthBalance: bigint;
  agentRoles: bigint[];
  roleInfo: Map<string, RoleInfo>;
  recentActionHistory: HistoricalAction[];
  mandates: Awaited<ReturnType<typeof getAllMandates>>;
  openActions: Awaited<ReturnType<typeof getOpenActions>>;
  linkedInstancesSummary: string;
}

export async function buildContext(
  session: AgentSession,
  org: OrganisationConfig,
  triggeredBy: GovernanceContext['triggeredBy'] = 'xmtp_message',
  groupName = '',
  groupType: GovernanceContext['groupType'] = 'unknown',
  contextId = 0
): Promise<GovernanceContext> {
  const [mandates, openActions, agentRoles, currentBlock, agentEthBalance, orgName, orgUri] =
    await Promise.all([
      getAllMandates(org.chainId, org.powersAddress),
      getOpenActions(org.chainId, org.powersAddress, session.userAddress),
      getAgentRoles(org.chainId, org.powersAddress, session.userAddress),
      getCurrentBlock(org.chainId),
      getEthBalance(org.chainId, session.userAddress),
      getOrgName(org.chainId, org.powersAddress),
      getOrgUri(org.chainId, org.powersAddress),
    ]);

  const roleInfo = await getAllRoleInfo(org.chainId, org.powersAddress, mandates);
  const orgKey = `${org.chainId}:${org.powersAddress}`;
  const recentActionHistory = session.orgActionHistory.get(orgKey) ?? [];
  const linkedInstances = session.linkedInstancesCache.get(orgKey) ?? [];
  const linkedInstancesSummary = formatLinkedInstancesSummary(linkedInstances);

  return {
    triggeredBy,
    groupName,
    groupType,
    contextId,
    powersAddress: org.powersAddress,
    chainId: org.chainId,
    orgName,
    orgUri,
    agentAddress: session.userAddress,
    currentBlock,
    agentEthBalance,
    agentRoles,
    roleInfo,
    recentActionHistory,
    mandates,
    openActions,
    linkedInstancesSummary,
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
      const ri = ctx.roleInfo.get(m.conditions.allowedRole.toString());
      const roleDisplay = ri?.label
        ? `${m.conditions.allowedRole} ("${ri.label}"${ri.metadata ? ` — ${ri.metadata}` : ''})`
        : `${m.conditions.allowedRole}`;
      return [
        `  [${m.mandateId}] mandate #${m.mandateId} — role ${roleDisplay}`,
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

  const historyLines = ctx.recentActionHistory
    .slice(0, 20)
    .map((a) =>
      [
        `  ActionId=${a.actionId} | Mandate=${a.mandateId} | State=${a.state} | Block=${a.proposedAt} | Caller=${a.caller}`,
        a.description ? `  Description: "${a.description}"` : null,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n\n');

  return [
    '=== GOVERNANCE STATE ===',
    `Trigger: ${ctx.triggeredBy}${ctx.groupName ? ` in ${ctx.groupName} (${ctx.groupType} #${ctx.contextId})` : ''}`,
    `Organisation: ${ctx.orgName || ctx.powersAddress} (${ctx.powersAddress}, chain ${ctx.chainId})`,
    ...(ctx.orgUri ? [`Org metadata: ${ctx.orgUri}`] : []),
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
    '',
    'RECENT ACTION HISTORY (LAST 30 DAYS):',
    historyLines || '  (none)',
    ...(ctx.linkedInstancesSummary ? ['', ctx.linkedInstancesSummary] : []),
    '=== END STATE ===',
  ].join('\n');
}
