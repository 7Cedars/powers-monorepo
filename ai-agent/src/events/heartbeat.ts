import type { AgentSession, OrganisationConfig } from '../agent/AgentSession.js';
import { reason } from '../ai/reason.js';
import { findGroup, getGroupName } from '../xmtp/groupAccess.js';
import { getAllMandates, getAgentRoles } from '../powers/contract.js';

const HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const SKIP_IF_EVENT_WITHIN_MS = 5 * 60 * 1000; // 5 minutes

const HEARTBEAT_TRIGGER = `[HEARTBEAT — scheduled 15-minute review]

You have not been triggered by any external event. This is your regular check-in.
Review the current governance state below and decide if there is anything you should
initiate, vote on, or execute. If there is nothing to do, do not send a message to
the group — stay silent. Only act if your strategy calls for it.

Key questions to consider:
- Are there active proposals you have not yet voted on?
- Have any proposals reached Succeeded state with a cleared timelock that you should execute?
- Given your strategy, is there an action you should propose right now?
- Are there any mandates where you are the only (or primary) participant, meaning
  no action will happen unless you initiate it?`;

export function startHeartbeat(
  session: AgentSession,
  org: OrganisationConfig
): void {
  const key = `${org.chainId}:${org.powersAddress}`;

  const timer = setInterval(
    () => runHeartbeat(session, org).catch((err) =>
      console.error(`[heartbeat] error (session=${session.sessionId} org=${key}):`, err)
    ),
    HEARTBEAT_INTERVAL_MS
  );

  session.heartbeatTimers.set(key, timer);
  console.log(`[heartbeat] started for session=${session.sessionId} org=${key}`);
}

export function stopHeartbeat(
  session: AgentSession,
  org: OrganisationConfig
): void {
  const key = `${org.chainId}:${org.powersAddress}`;
  const timer = session.heartbeatTimers.get(key);
  if (timer) {
    clearInterval(timer);
    session.heartbeatTimers.delete(key);
    console.log(`[heartbeat] stopped for session=${session.sessionId} org=${key}`);
  }
}

async function runHeartbeat(
  session: AgentSession,
  org: OrganisationConfig
): Promise<void> {
  const key = `${org.chainId}:${org.powersAddress}`;

  // Skip if a recent on-chain event already triggered reasoning for this org
  const lastEvent = session.lastEventReasonAt.get(key) ?? 0;
  if (Date.now() - lastEvent < SKIP_IF_EVENT_WITHIN_MS) {
    console.log(`[heartbeat] skipping — recent event reasoning for ${key}`);
    return;
  }

  console.log(`[heartbeat] running for session=${session.sessionId} org=${key}`);

  const homeGroup = await resolveHomeGroup(session, org);

  const conversationId = homeGroup
    ? homeGroup.id
    : `heartbeat:${org.powersAddress}`;

  const groupReply = homeGroup
    ? async (text: string) => { await homeGroup.sendText(text); }
    : async (_text: string) => { /* no group — on-chain actions only */ };

  await reason(session, org, conversationId, HEARTBEAT_TRIGGER, groupReply, 'heartbeat');
}

async function resolveHomeGroup(
  session: AgentSession,
  org: OrganisationConfig
): Promise<any | null> {
  if (!session.xmtpClient) return null;

  try {
    const [mandates, agentRoles] = await Promise.all([
      getAllMandates(org.chainId, org.powersAddress),
      getAgentRoles(org.chainId, org.powersAddress, session.userAddress),
    ]);

    if (agentRoles.length === 0) return null;

    const activeMandates = mandates.filter(
      (m) => m.active && agentRoles.includes(m.conditions.allowedRole)
    );

    if (activeMandates.length === 0) return null;

    // Prefer admin role (roleId 0) group first
    const adminMandate = activeMandates.find(
      (m) => m.conditions.allowedRole === 0n
    );

    // Otherwise use the lowest mandateId
    const candidates = adminMandate
      ? [adminMandate, ...activeMandates.filter((m) => m !== adminMandate)]
      : activeMandates.sort((a, b) => a.mandateId - b.mandateId);

    for (const mandate of candidates) {
      const groupName = getGroupName(
        'Mandate',
        org.chainId,
        org.powersAddress,
        BigInt(mandate.mandateId)
      );

      const group = await findGroup(session, groupName);
      if (group) return group;
    }

    return null;
  } catch (err) {
    console.error(`[heartbeat] resolveHomeGroup error:`, err);
    return null;
  }
}
