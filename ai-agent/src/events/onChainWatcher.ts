import { type Address, type WatchContractEventReturnType } from 'viem';
import { getWatchClient, isPowersContract, getAllMandates } from '../powers/contract.js';
import { powersAbi } from '../powers/abi.js';
import type { AgentSession, OrganisationConfig } from '../agent/AgentSession.js';
import { reason } from '../ai/reason.js';
import { findGroup, getGroupName, requestOrgGroupAccess } from '../xmtp/groupAccess.js';
import { discoverLinkedInstances } from '../powers/linkedInstances.js';

// Returns unwatch functions for all watchers started for this (session, org) pair
export function startWatchers(
  session: AgentSession,
  org: OrganisationConfig
): WatchContractEventReturnType[] {
  const unwatchers: WatchContractEventReturnType[] = [];
  const orgKey = `${org.chainId}:${org.powersAddress}`;

  // ── RoleSet ────────────────────────────────────────────────────────────────
  const unwatchRoleSet = getWatchClient(org.chainId).watchContractEvent({
    address: org.powersAddress,
    abi: powersAbi,
    eventName: 'RoleSet',
    onLogs: async (logs) => {
      for (const log of logs as any[]) {
        const { account, roleId, access } = log.args as {
          account: Address;
          roleId: bigint;
          access: boolean;
        };

        if (account.toLowerCase() === session.userAddress.toLowerCase()) {
          if (access) {
            console.log(
              `[watcher] ${session.sessionId} gained role ${roleId} on ${org.powersAddress}`
            );
            await handleRoleGained(session, org, roleId);
          } else {
            console.log(
              `[watcher] ${session.sessionId} lost role ${roleId} on ${org.powersAddress}`
            );
          }
        } else if (access) {
          // Another account gained a role — check if it's a Powers instance and refresh cache
          await handleMemberAdded(session, org, account);
        }
      }
    },
    onError: (err) => {
      console.error(`[watcher] RoleSet error (${orgKey}):`, err);
    },
  });
  unwatchers.push(unwatchRoleSet);

  // ── ProposedActionCreated ──────────────────────────────────────────────────
  const unwatchProposed = getWatchClient(org.chainId).watchContractEvent({
    address: org.powersAddress,
    abi: powersAbi,
    eventName: 'ProposedActionCreated',
    onLogs: async (logs) => {
      for (const log of logs as any[]) {
        const { actionId, mandateId } = log.args as {
          actionId: bigint;
          mandateId: number;
        };

        // Don't react to proposals we made ourselves
        const caller = log.args.caller as Address | undefined;
        if (caller?.toLowerCase() === session.userAddress.toLowerCase()) continue;

        console.log(
          `[watcher] ProposedActionCreated action=${actionId} mandate=${mandateId} (${orgKey})`
        );

        updateLastEventTime(session, orgKey);
        await triggerReasonOnMandateGroup(
          session,
          org,
          mandateId,
          `[ON-CHAIN EVENT] A new action has been proposed.\nActionId: ${actionId}\nMandateId: ${mandateId}\n\nReview the governance state and decide whether to vote.`
        );
      }
    },
    onError: (err) => {
      console.error(`[watcher] ProposedActionCreated error (${orgKey}):`, err);
    },
  });
  unwatchers.push(unwatchProposed);

  // ── VoteCast ───────────────────────────────────────────────────────────────
  // Watch VoteCast to detect when voting completes and action may become Succeeded.
  // We check state after any vote and trigger reasoning if Succeeded + timelock cleared.
  const unwatchVote = getWatchClient(org.chainId).watchContractEvent({
    address: org.powersAddress,
    abi: powersAbi,
    eventName: 'VoteCast',
    onLogs: async (logs) => {
      for (const log of logs as any[]) {
        const { actionId } = log.args as { actionId: bigint };

        // Check if this action is now Succeeded
        try {
          const { getActionData, getActionVoteData, getCurrentBlock, getAllMandates } =
            await import('../powers/contract.js');

          const [actionData, voteData, currentBlock, mandates] = await Promise.all([
            getActionData(org.chainId, org.powersAddress, actionId) as any,
            getActionVoteData(org.chainId, org.powersAddress, actionId),
            getCurrentBlock(org.chainId),
            getAllMandates(org.chainId, org.powersAddress),
          ]);

          const { ActionState } = await import('../powers/contract.js');
          if (actionData.state !== ActionState.Succeeded) continue;

          const mandate = mandates.find((m: any) => m.mandateId === actionData.mandateId);
          const timelock = mandate?.conditions.timelock ?? 0n;
          if (currentBlock < BigInt(voteData.voteEnd) + BigInt(timelock)) continue;

          console.log(
            `[watcher] action ${actionId} is Succeeded + timelock cleared (${orgKey})`
          );

          updateLastEventTime(session, orgKey);
          await triggerReasonOnMandateGroup(
            session,
            org,
            actionData.mandateId,
            `[ON-CHAIN EVENT] Action ${actionId} has Succeeded and the timelock has cleared.\nMandateId: ${actionData.mandateId}\n\nReview and execute if appropriate.`
          );
        } catch (err) {
          console.error(`[watcher] VoteCast state check error:`, err);
        }
      }
    },
    onError: (err) => {
      console.error(`[watcher] VoteCast error (${orgKey}):`, err);
    },
  });
  unwatchers.push(unwatchVote);

  console.log(`[watcher] started for session=${session.sessionId} org=${orgKey}`);
  return unwatchers;
}

async function handleRoleGained(
  session: AgentSession,
  org: OrganisationConfig,
  roleId: bigint
): Promise<void> {
  if (!session.xmtpClient) return;

  try {
    // Create any mandate or flow groups the agent is now eligible for
    await requestOrgGroupAccess(session, org);

    const mandates = await getAllMandates(org.chainId, org.powersAddress);
    const mandatesForRole = mandates.filter(
      (m) => m.active && m.conditions.allowedRole === roleId
    );

    for (const mandate of mandatesForRole) {
      const groupName = getGroupName(
        'Mandate',
        org.chainId,
        org.powersAddress,
        BigInt(mandate.mandateId)
      );

      const group = await findGroup(session, groupName);
      if (!group) continue;

      const introTrigger =
        `[ON-CHAIN EVENT] You have just been granted role ${roleId}, ` +
        `which allows you to call mandate ${mandate.mandateId}.\n\n` +
        `Introduce yourself briefly to the group and review the current governance state.`;

      updateLastEventTime(session, `${org.chainId}:${org.powersAddress}`);
      await reason(
        session,
        org,
        group.id,
        introTrigger,
        async (text) => { await group.sendText(text); },
        'on_chain_event'
      );
    }
  } catch (err) {
    console.error(`[watcher] handleRoleGained error:`, err);
  }
}

async function handleMemberAdded(
  session: AgentSession,
  org: OrganisationConfig,
  newMember: Address
): Promise<void> {
  const memberIsPowers = await isPowersContract(org.chainId, newMember);
  if (!memberIsPowers) return;

  console.log(
    `[watcher] new member ${newMember} is a Powers instance — refreshing linked cache for ${org.powersAddress}`
  );
  try {
    const mandates = await getAllMandates(org.chainId, org.powersAddress);
    const linked = await discoverLinkedInstances(org.chainId, org.powersAddress, mandates);
    session.linkedInstancesCache.set(`${org.chainId}:${org.powersAddress}`, linked);
  } catch (err) {
    console.error(`[watcher] linked instance refresh failed for ${org.powersAddress}:`, err);
  }
}

async function triggerReasonOnMandateGroup(
  session: AgentSession,
  org: OrganisationConfig,
  mandateId: number,
  triggerText: string
): Promise<void> {
  if (!session.xmtpClient) return;

  const groupName = getGroupName(
    'Mandate',
    org.chainId,
    org.powersAddress,
    BigInt(mandateId)
  );

  const group = await findGroup(session, groupName);

  if (group) {
    await reason(
      session,
      org,
      group.id,
      triggerText,
      async (text) => { await group.sendText(text); },
      'on_chain_event'
    );
  } else {
    // Agent has no group to chat in, but can still reason and act on-chain
    console.log(
      `[watcher] no group found for mandate ${mandateId} — reasoning silently`
    );
    await reason(
      session,
      org,
      `silent:${org.powersAddress}:${mandateId}`,
      triggerText,
      async () => { /* no group to reply to */ },
      'on_chain_event'
    );
  }
}

function updateLastEventTime(session: AgentSession, orgKey: string): void {
  session.lastEventReasonAt.set(orgKey, Date.now());
}
