import type { Tool } from '@anthropic-ai/sdk/resources/messages.js';
import type { AgentSession, OrganisationConfig } from '../../agent/AgentSession.js';
import { buildContext, formatContextMessage } from '../contextBuilder.js';
import {
  getActionData,
  getActionUri,
  hasVoted,
  ActionState,
} from '../../powers/contract.js';
import {
  propose,
  castVoteWithReason,
  request,
} from '../../write/powersWriter.js';
import { findTemplate } from '../../mandates/templateRegistry.js';
import { dispatchSkill } from './skillTools.js';

export const governanceToolDefinitions: Tool[] = [
  {
    name: 'get_governance_state',
    description:
      'Fetch the current on-chain governance state for the active organisation. Call this before any governance action to ensure you have fresh data.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'send_message',
    description: 'Send a message to the current XMTP governance group chat.',
    input_schema: {
      type: 'object' as const,
      properties: {
        text: { type: 'string', description: 'The message to send.' },
      },
      required: ['text'],
    },
  },
  {
    name: 'fund_check',
    description: 'Check the agent ETH balance across all organisations to assess gas capacity.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'propose_action',
    description:
      'Propose a new governance action on a mandate. Encodes calldata from the mandate template automatically when possible.',
    input_schema: {
      type: 'object' as const,
      properties: {
        mandateId: { type: 'number', description: 'ID of the mandate to propose on.' },
        powersAddress: {
          type: 'string',
          description: 'Powers organisation address. Omit if agent serves only one organisation.',
        },
        parameters: {
          type: 'object',
          description: 'Named parameters for the mandate template.',
        },
        mandateCalldata: {
          type: 'string',
          description: '0x-prefixed raw calldata. Use only if no template exists for this mandate.',
        },
        nonce: {
          type: 'string',
          description: 'Decimal nonce. Auto-generated (Date.now()) if omitted.',
        },
        uri: {
          type: 'string',
          description: 'Human-readable description stored on-chain with the proposal.',
        },
        reasoning: {
          type: 'string',
          description: 'Why you are making this proposal. Logged locally.',
        },
      },
      required: ['mandateId', 'uri', 'reasoning'],
    },
  },
  {
    name: 'cast_vote',
    description: 'Cast a vote on an active governance action. Reasoning is stored on-chain.',
    input_schema: {
      type: 'object' as const,
      properties: {
        actionId: { type: 'string', description: 'Decimal action ID.' },
        powersAddress: {
          type: 'string',
          description: 'Organisation address. Omit if agent serves only one organisation.',
        },
        support: {
          type: 'number',
          enum: [0, 1, 2],
          description: '0 = Against, 1 = For, 2 = Abstain.',
        },
        reasoning: {
          type: 'string',
          description: 'Required. Stored on-chain as the vote reason.',
        },
      },
      required: ['actionId', 'support', 'reasoning'],
    },
  },
  {
    name: 'execute_action',
    description:
      'Execute a passed governance action once the timelock has cleared. Verifies state before submitting.',
    input_schema: {
      type: 'object' as const,
      properties: {
        actionId: { type: 'string', description: 'Decimal action ID.' },
        powersAddress: {
          type: 'string',
          description: 'Organisation address. Omit if agent serves only one organisation.',
        },
        reasoning: { type: 'string', description: 'Why you are executing this action.' },
      },
      required: ['actionId', 'reasoning'],
    },
  },
];

export interface ToolCallContext {
  session: AgentSession;
  org: OrganisationConfig;
  conversationId: string;
  groupReply: (text: string) => Promise<void>;
}

function resolveOrg(
  session: AgentSession,
  defaultOrg: OrganisationConfig,
  powersAddress?: string
): OrganisationConfig {
  if (!powersAddress) return defaultOrg;
  const found = session.organisations.find(
    (o) => o.powersAddress.toLowerCase() === powersAddress.toLowerCase()
  );
  return found ?? defaultOrg;
}

export async function handleToolCall(
  toolName: string,
  toolInput: Record<string, unknown>,
  ctx: ToolCallContext
): Promise<string> {
  const { session, org, groupReply } = ctx;

  switch (toolName) {
    case 'get_governance_state': {
      const context = await buildContext(session, org, 'xmtp_message', '', 'unknown', 0);
      return formatContextMessage(context);
    }

    case 'send_message': {
      const text = String(toolInput.text ?? '');
      if (!text.trim()) return 'Error: empty message.';
      await groupReply(text);
      return 'Message sent.';
    }

    case 'fund_check': {
      const { getEthBalance } = await import('../../powers/contract.js');
      const lines = await Promise.all(
        session.organisations.map(async (o) => {
          const bal = await getEthBalance(o.chainId, session.userAddress);
          const eth = (Number(bal) / 1e18).toFixed(6);
          return `  ${o.label || o.powersAddress} (chain ${o.chainId}): ${eth} ETH`;
        })
      );
      return `ETH balance across ${session.organisations.length} organisations:\n${lines.join('\n')}`;
    }

    case 'propose_action': {
      const targetOrg = resolveOrg(session, org, toolInput.powersAddress as string | undefined);
      const mandateId = Number(toolInput.mandateId);
      const nonce = toolInput.nonce ? BigInt(toolInput.nonce as string) : BigInt(Date.now());
      const uri = String(toolInput.uri ?? '');
      const reasoning = String(toolInput.reasoning ?? '');

      let calldata: `0x${string}`;

      if (toolInput.mandateCalldata) {
        calldata = toolInput.mandateCalldata as `0x${string}`;
      } else {
        // Find mandate name to look up template
        const { getAllMandates } = await import('../../powers/contract.js');
        const mandates = await getAllMandates(targetOrg.chainId, targetOrg.powersAddress);
        const mandate = mandates.find((m) => m.mandateId === mandateId);

        if (!mandate) {
          return `Error: mandate ${mandateId} not found in ${targetOrg.powersAddress}.`;
        }

        // Try to find template by mandate address (targetMandate) or fuzzy name
        // The nameDescription comes from the flow or mandate metadata
        const template = findTemplate(mandate.targetMandate);
        if (!template) {
          return (
            `No encoding template registered for mandate ${mandateId} ` +
            `(target: ${mandate.targetMandate}). Provide raw hex mandateCalldata instead.`
          );
        }

        try {
          calldata = template.encode(
            (toolInput.parameters as Record<string, unknown>) ?? {}
          );
        } catch (err) {
          return `Template encoding error for ${template.name}: ${String(err)}`;
        }
      }

      console.log(
        `[tool] propose_action mandate=${mandateId} reasoning="${reasoning}" session=${session.sessionId}`
      );

      try {
        const { actionId, txHash } = await propose(
          session,
          targetOrg,
          mandateId,
          calldata,
          nonce,
          uri
        );
        return `Proposed. ActionId=${actionId} | TxHash=${txHash}`;
      } catch (err: any) {
        return `Proposal failed: ${err?.shortMessage ?? String(err)}`;
      }
    }

    case 'cast_vote': {
      const targetOrg = resolveOrg(session, org, toolInput.powersAddress as string | undefined);
      const actionId = BigInt(toolInput.actionId as string);
      const support = Number(toolInput.support) as 0 | 1 | 2;
      const reasoning = String(toolInput.reasoning ?? '');

      // Verify action is active
      const actionData = await getActionData(targetOrg.chainId, targetOrg.powersAddress, actionId) as any;
      if (actionData.state !== ActionState.Active) {
        return `Error: action ${actionId} is not Active (state=${actionData.state}).`;
      }

      // Verify agent hasn't already voted
      const voted = await hasVoted(
        targetOrg.chainId,
        targetOrg.powersAddress,
        actionId,
        session.userAddress
      );
      if (voted) {
        return `Error: agent has already voted on action ${actionId}.`;
      }

      const supportLabel = support === 1 ? 'FOR' : support === 0 ? 'AGAINST' : 'ABSTAIN';
      console.log(
        `[tool] cast_vote action=${actionId} support=${supportLabel} session=${session.sessionId}`
      );

      try {
        const { txHash } = await castVoteWithReason(
          session,
          targetOrg,
          actionId,
          support,
          reasoning
        );
        return `Vote cast: ${supportLabel} on action ${actionId} | TxHash=${txHash}`;
      } catch (err: any) {
        return `Vote failed: ${err?.shortMessage ?? String(err)}`;
      }
    }

    case 'execute_action': {
      const targetOrg = resolveOrg(session, org, toolInput.powersAddress as string | undefined);
      const actionId = BigInt(toolInput.actionId as string);
      const reasoning = String(toolInput.reasoning ?? '');

      // Get action data
      const actionData = await getActionData(targetOrg.chainId, targetOrg.powersAddress, actionId) as any;

      if (actionData.state !== ActionState.Succeeded) {
        return `Error: action ${actionId} is not in Succeeded state (state=${actionData.state}).`;
      }

      // Check timelock
      const { getActionVoteData, getAllMandates, getCurrentBlock } = await import('../../powers/contract.js');
      const [voteData, mandates, currentBlock] = await Promise.all([
        getActionVoteData(targetOrg.chainId, targetOrg.powersAddress, actionId),
        getAllMandates(targetOrg.chainId, targetOrg.powersAddress),
        getCurrentBlock(targetOrg.chainId),
      ]);

      const mandate = mandates.find((m) => m.mandateId === actionData.mandateId);
      const timelock = mandate?.conditions.timelock ?? 0n;
      const readyAt = BigInt(voteData.voteEnd) + BigInt(timelock);

      if (currentBlock < readyAt) {
        return `Timelock not cleared. Ready at block ${readyAt}, current block ${currentBlock}.`;
      }

      // Get original calldata and uri for re-submission
      const calldata = actionData.calldata as `0x${string}`;
      const uri = await getActionUri(targetOrg.chainId, targetOrg.powersAddress, actionId);

      console.log(
        `[tool] execute_action action=${actionId} reasoning="${reasoning}" session=${session.sessionId}`
      );

      try {
        const { txHash } = await request(
          session,
          targetOrg,
          actionData.mandateId,
          calldata,
          actionData.nonce,
          uri
        );
        return `Execution submitted | TxHash=${txHash}`;
      } catch (err: any) {
        return `Execution failed: ${err?.shortMessage ?? String(err)}`;
      }
    }

    default: {
      // Check if this is a user-defined skill
      const skill = session.skills.find((s) => s.definition.name === toolName);
      if (skill) {
        try {
          return await dispatchSkill(skill, toolInput);
        } catch (err) {
          return `Skill error (${toolName}): ${String(err)}`;
        }
      }
      return `Unknown tool: ${toolName}`;
    }
  }
}
