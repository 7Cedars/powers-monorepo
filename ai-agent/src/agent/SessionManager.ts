import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/env.js';
import {
  createSession,
  sessionToSummary,
  zeroSessionKeys,
  type AgentSession,
  type OrganisationConfig,
  type SessionStartInput,
  type SessionSummary,
} from './AgentSession.js';

class SessionManager {
  private sessions = new Map<string, AgentSession>();

  async createSession(
    input: SessionStartInput,
    onDestroy?: (session: AgentSession) => void
  ): Promise<string> {
    const ttlMs = Math.max(
      config.session.ttlMinMs,
      Math.min(config.session.ttlMaxMs, input.ttlMs)
    );

    const sessionId = uuidv4();
    const session = createSession(sessionId, { ...input, ttlMs });

    const timer = setTimeout(() => {
      console.log(`[session] TTL expired for ${sessionId}`);
      this.destroySession(sessionId, onDestroy);
    }, ttlMs);

    session.expiryTimer = timer;
    this.sessions.set(sessionId, session);

    console.log(
      `[session] created ${sessionId} for ${session.userAddress} (TTL ${ttlMs}ms)`
    );
    return sessionId;
  }

  destroySession(
    sessionId: string,
    onDestroy?: (session: AgentSession) => void
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear TTL timer
    if (session.expiryTimer) {
      clearTimeout(session.expiryTimer);
      session.expiryTimer = null;
    }

    // Clear all heartbeat timers
    for (const timer of session.heartbeatTimers.values()) {
      clearInterval(timer);
    }
    session.heartbeatTimers.clear();

    // Notify caller so it can close XMTP client and WebSocket watchers
    try {
      onDestroy?.(session);
    } catch (err) {
      console.error(`[session] onDestroy error for ${sessionId}:`, err);
    }

    // Zero sensitive key material
    zeroSessionKeys(session);

    this.sessions.delete(sessionId);
    console.log(`[session] destroyed ${sessionId}`);
  }

  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId);
  }

  findSessionsForGroup(groupName: string): AgentSession[] {
    // Parse group name format: Mandate-{chainId}-{powersAddress}-{contextId}
    const parts = groupName.split('-');
    if (parts.length !== 4) return [];
    const chainId = parseInt(parts[1], 10);
    const powersAddress = parts[2].toLowerCase();

    const results: AgentSession[] = [];
    for (const session of this.sessions.values()) {
      if (!session.xmtpClient) continue;
      const hasOrg = session.organisations.some(
        (o) =>
          o.chainId === chainId &&
          o.powersAddress.toLowerCase() === powersAddress
      );
      if (hasOrg) results.push(session);
    }
    return results;
  }

  listSessions(): SessionSummary[] {
    return Array.from(this.sessions.values()).map(sessionToSummary);
  }

  touchSession(sessionId: string, onDestroy?: (session: AgentSession) => void): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.lastActiveAt = Date.now();

    // Reset TTL timer
    if (session.expiryTimer) clearTimeout(session.expiryTimer);
    session.expiryTimer = setTimeout(() => {
      console.log(`[session] TTL expired for ${sessionId}`);
      this.destroySession(sessionId, onDestroy);
    }, session.ttlMs);
  }

  addOrganisation(sessionId: string, org: OrganisationConfig): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    const exists = session.organisations.some(
      (o) => o.powersAddress === org.powersAddress && o.chainId === org.chainId
    );
    if (!exists) session.organisations.push(org);
    return true;
  }
}

export const sessionManager = new SessionManager();
