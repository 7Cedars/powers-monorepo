import Anthropic from '@anthropic-ai/sdk';
import { privateKeyToAccount } from 'viem/accounts';
export function createSession(sessionId, input) {
    const walletSigner = privateKeyToAccount(input.walletKey);
    const claudeClient = new Anthropic({ apiKey: input.claudeApiKey });
    const skills = input.skills.map((def) => ({
        definition: def,
        tool: {
            name: def.name,
            description: def.description,
            input_schema: def.inputSchema,
        },
    }));
    return {
        sessionId,
        userAddress: walletSigner.address,
        walletKey: input.walletKey,
        walletSigner,
        claudeApiKey: input.claudeApiKey,
        claudeClient,
        organisations: input.organisations,
        persona: input.persona,
        skills,
        xmtpClient: null,
        histories: new Map(),
        lastReplyAt: new Map(),
        orgActionHistory: new Map(),
        linkedInstancesCache: new Map(),
        ttlMs: input.ttlMs,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        expiryTimer: null,
        heartbeatTimers: new Map(),
        lastEventReasonAt: new Map(),
    };
}
export function sessionToSummary(session) {
    const expiresAt = new Date(session.createdAt + session.ttlMs).toISOString();
    return {
        sessionId: session.sessionId,
        agentAddress: session.userAddress,
        organisations: session.organisations,
        personaName: session.persona.name,
        persona: session.persona,
        createdAt: new Date(session.createdAt).toISOString(),
        lastActiveAt: new Date(session.lastActiveAt).toISOString(),
        expiresAt,
    };
}
export function zeroSessionKeys(session) {
    try {
        Buffer.from(session.walletKey.slice(2), 'hex').fill(0);
    }
    catch { }
    try {
        Buffer.from(session.claudeApiKey).fill(0);
    }
    catch { }
}
