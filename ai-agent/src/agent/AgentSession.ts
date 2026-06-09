import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js';
import Anthropic from '@anthropic-ai/sdk';
import type { PrivateKeyAccount, Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { Agent } from '@xmtp/agent-sdk';
import type { HistoricalAction } from '../powers/contract.js';
import type { LinkedInstance } from '../powers/linkedInstances.js';

export interface OrganisationConfig {
  powersAddress: Address;
  chainId: number;
  label?: string;
  xmtpAgentAddress?: string;
}

export interface AgentPersona {
  name: string;
  roleDescription: string;
  strategy: string;
  constraints?: string;
  model?: string;
}

export interface SkillDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: string;
  handlerConfig: Record<string, unknown>;
}

export interface ResolvedSkill {
  definition: SkillDefinition;
  tool: {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  };
}

export interface AgentSession {
  sessionId: string;
  userAddress: Address;
  walletKey: `0x${string}`;
  walletSigner: PrivateKeyAccount;
  claudeApiKey: string;
  claudeClient: Anthropic;

  organisations: OrganisationConfig[];
  persona: AgentPersona;
  skills: ResolvedSkill[];

  xmtpClient: Agent | null;

  histories: Map<string, MessageParam[]>;
  lastReplyAt: Map<string, number>;
  orgActionHistory: Map<string, HistoricalAction[]>;
  linkedInstancesCache: Map<string, LinkedInstance[]>;

  ttlMs: number;
  createdAt: number;
  lastActiveAt: number;
  expiryTimer: NodeJS.Timeout | null;
  heartbeatTimers: Map<string, NodeJS.Timeout>;
  lastEventReasonAt: Map<string, number>;
}

export interface SessionStartInput {
  walletKey: `0x${string}`;
  claudeApiKey: string;
  organisations: OrganisationConfig[];
  persona: AgentPersona;
  skills: SkillDefinition[];
  ttlMs: number;
}

export interface SessionSummary {
  sessionId: string;
  agentAddress: Address;
  organisations: OrganisationConfig[];
  personaName: string;
  persona: AgentPersona;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

export function createSession(
  sessionId: string,
  input: SessionStartInput
): AgentSession {
  const walletSigner = privateKeyToAccount(input.walletKey);

  const claudeClient = new Anthropic({ apiKey: input.claudeApiKey });

  const skills: ResolvedSkill[] = input.skills.map((def) => ({
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

export function sessionToSummary(session: AgentSession): SessionSummary {
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

export function zeroSessionKeys(session: AgentSession): void {
  try {
    Buffer.from(session.walletKey.slice(2), 'hex').fill(0);
  } catch {}
  try {
    Buffer.from(session.claudeApiKey).fill(0);
  } catch {}
}
