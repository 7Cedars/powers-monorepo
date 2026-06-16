import './config/env.js'; // load + validate env first
import type { WatchContractEventReturnType } from 'viem';
import { createServer } from './api/server.js';
import { sessionManager } from './agent/SessionManager.js';
import { createXmtpClient } from './xmtp/client.js';
import { startGroupStream } from './xmtp/groupStream.js';
import { requestOrgGroupAccess } from './xmtp/groupAccess.js';
import { backfillGroupChatHistory } from './xmtp/chatHistory.js';
import { startWatchers } from './events/onChainWatcher.js';
import { startHeartbeat, stopHeartbeat } from './events/heartbeat.js';
import { reason } from './ai/reason.js';
import { getActionHistory, getAllMandates } from './powers/contract.js';
import { discoverLinkedInstances } from './powers/linkedInstances.js';
import { config } from './config/env.js';
import type { AgentSession, OrganisationConfig } from './agent/AgentSession.js';

// Per-session WebSocket unwatch functions keyed by `${sessionId}:${chainId}:${powersAddress}`
const unwatchers = new Map<string, WatchContractEventReturnType[]>();

function startOrgListeners(session: AgentSession, org: OrganisationConfig): void {
  const orgKey = `${session.sessionId}:${org.chainId}:${org.powersAddress}`;
  if (unwatchers.has(orgKey)) return; // already running

  const watches = startWatchers(session, org);
  unwatchers.set(orgKey, watches);
  startHeartbeat(session, org);
}

function stopOrgListeners(session: AgentSession, org: OrganisationConfig): void {
  const orgKey = `${session.sessionId}:${org.chainId}:${org.powersAddress}`;
  const watches = unwatchers.get(orgKey);
  if (watches) {
    for (const unwatch of watches) {
      try { unwatch(); } catch {}
    }
    unwatchers.delete(orgKey);
  }
  stopHeartbeat(session, org);
}

async function onSessionStart(sessionId: string): Promise<void> {
  const session = sessionManager.getSession(sessionId);
  if (!session) return;

  // 1. Create per-session XMTP client
  try {
    const xmtpClient = await createXmtpClient(session);
    session.xmtpClient = xmtpClient;
  } catch (err) {
    console.error(`[index] XMTP client creation failed for ${sessionId}:`, err);
    return;
  }

  // 1.5 Backfill XMTP chat history for groups the agent is already in (fire-and-forget)
  backfillGroupChatHistory(session).catch((err) =>
    console.error(`[index] chat history backfill failed for ${sessionId}:`, err)
  );

  // 2. Start group message stream — org is resolved from the group name inside the stream
  startGroupStream(
    session,
    async (sess, org, conversationId, triggerText, groupReply) => {
      await reason(sess, org, conversationId, triggerText, groupReply, 'xmtp_message');
    }
  );

  // 3. Request access to XMTP groups for all eligible mandates/flows (fire-and-forget)
  for (const org of session.organisations) {
    requestOrgGroupAccess(session, org).catch((err) =>
      console.error(`[index] requestOrgGroupAccess error for ${org.powersAddress}:`, err)
    );
  }

  // 5. Start on-chain watchers + heartbeat for each initial organisation
  for (const org of session.organisations) {
    startOrgListeners(session, org);
  }

  // 6. Load on-chain action history for each org (fire-and-forget)
  for (const org of session.organisations) {
    const key = `${org.chainId}:${org.powersAddress}`;
    getActionHistory(org.chainId, org.powersAddress, 30)
      .then((history) => {
        session.orgActionHistory.set(key, history);
        console.log(`[index] loaded ${history.length} historical actions for ${org.powersAddress}`);
      })
      .catch((err) =>
        console.error(`[index] action history load failed for ${org.powersAddress}:`, err)
      );
  }

  // 7. Discover linked Powers instances for each org (fire-and-forget)
  for (const org of session.organisations) {
    discoverLinkedInstancesForOrg(session, org);
  }

  console.log(
    `[index] session ${sessionId} started — addr=${session.userAddress} ` +
    `orgs=${session.organisations.length}`
  );
}

function onSessionDestroy(sessionId: string): void {
  const session = sessionManager.getSession(sessionId);

  if (session) {
    for (const org of session.organisations) {
      stopOrgListeners(session, org);
    }
    if (session.xmtpClient) {
      session.xmtpClient = null;
    }
  }

  console.log(`[index] session ${sessionId} torn down`);
}

function discoverLinkedInstancesForOrg(session: AgentSession, org: OrganisationConfig): void {
  const orgKey = `${org.chainId}:${org.powersAddress}`;
  getAllMandates(org.chainId, org.powersAddress)
    .then((mandates) => discoverLinkedInstances(org.chainId, org.powersAddress, mandates))
    .then((linked) => {
      session.linkedInstancesCache.set(orgKey, linked);
      if (linked.length > 0) {
        console.log(`[index] found ${linked.length} linked Powers instance(s) for ${orgKey}`);
      }
    })
    .catch((err) =>
      console.error(`[index] linked instance discovery failed for ${org.powersAddress}:`, err)
    );
}

// Called by the API server when a new org is added to a running session
function onOrgAdded(sessionId: string, org: OrganisationConfig): void {
  const session = sessionManager.getSession(sessionId);
  if (!session) return;
  startOrgListeners(session, org);
  requestOrgGroupAccess(session, org).catch((err) =>
    console.error(`[index] requestOrgGroupAccess error for new org ${org.powersAddress}:`, err)
  );
  discoverLinkedInstancesForOrg(session, org);
  console.log(`[index] added org ${org.powersAddress} to session ${sessionId}`);
}

const app = createServer(onSessionStart, onSessionDestroy, onOrgAdded);

const server = app.listen(config.server.port, () => {
  console.log(`[index] ai-agent listening on port ${config.server.port}`);
});

const shutdown = (): void => {
  console.log('[index] shutting down...');
  server.close();
  for (const s of sessionManager.listSessions()) {
    sessionManager.destroySession(s.sessionId, (sess) => onSessionDestroy(sess.sessionId));
  }
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
