import type { MessageParam, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages.js';
import type { AgentSession, OrganisationConfig } from '../agent/AgentSession.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { buildContext, formatContextMessage } from './contextBuilder.js';
import {
  governanceToolDefinitions,
  handleToolCall,
  type ToolCallContext,
} from './tools/governanceTools.js';
import { config } from '../config/env.js';
import { sessionManager } from '../agent/SessionManager.js';
import { claudeLimiter } from './rateLimiter.js';

export async function reason(
  session: AgentSession,
  org: OrganisationConfig,
  conversationId: string,
  triggerText: string,
  groupReply: (text: string) => Promise<void>,
  triggeredBy: 'xmtp_message' | 'on_chain_event' | 'heartbeat' = 'xmtp_message'
): Promise<void> {
  const systemPrompt = buildSystemPrompt(session);

  // Assemble the governance context block
  const govContext = await buildContext(session, org, triggeredBy);
  const contextBlock = formatContextMessage(govContext);

  const history: MessageParam[] = session.histories.get(conversationId) ?? [];

  // The user turn is: context state + trigger message
  const userContent = `${contextBlock}\n\n${triggerText}`;

  const messages: MessageParam[] = [
    ...history,
    { role: 'user', content: userContent },
  ];

  const toolCtx: ToolCallContext = {
    session,
    org,
    conversationId,
    groupReply,
  };

  const allTools = [
    ...governanceToolDefinitions,
    ...session.skills.map((s) => s.tool),
  ];

  // Cache system prompt and tool list — both are stable per session.
  // cache_control marks a breakpoint: everything up to and including it is cached.
  const systemParam = [
    { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
  ];
  const cachedTools = allTools.length > 0
    ? [
        ...allTools.slice(0, -1),
        { ...allTools[allTools.length - 1], cache_control: { type: 'ephemeral' } },
      ]
    : allTools;

  let rounds = 0;
  const maxRounds = config.ai.maxToolRounds;

  const thinkingBudget = config.ai.thinkingBudget;
  const apiParams = thinkingBudget > 0
    ? { thinking: { type: 'enabled' as const, budget_tokens: thinkingBudget }, max_tokens: Math.max(4096, thinkingBudget + 2000) }
    : { max_tokens: 4096 };

  const assistantParts: MessageParam[] = [];

  while (rounds < maxRounds) {
    rounds++;

    let response;
    try {
      response = await claudeLimiter.schedule(() =>
        session.claudeClient.messages.create({
          model: session.persona.model ?? 'claude-sonnet-4-6',
          system: systemParam as any,
          messages,
          tools: cachedTools as any,
          tool_choice: { type: 'auto' },
          ...apiParams,
        })
      );
    } catch (err: any) {
      console.error(`[reason] Claude API error (session ${session.sessionId}):`, err);

      // Retry with exponential backoff for rate limits
      if (err?.status === 429 && rounds <= 3) {
        const delay = 2000 * Math.pow(2, rounds - 1);
        console.log(`[reason] rate limited, retrying in ${delay}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (triggeredBy === 'xmtp_message') {
        await groupReply('I encountered an error accessing my AI capabilities. Please try again.');
      }
      return;
    }

    // Log thinking blocks when extended thinking is enabled
    for (const block of response.content) {
      if (block.type === 'thinking') {
        console.log(`[thinking] session ${session.sessionId}:\n${(block as any).thinking}`);
      }
    }

    // Collect assistant content for history
    const assistantMsg: MessageParam = {
      role: 'assistant',
      content: response.content,
    };
    assistantParts.push(assistantMsg);
    messages.push(assistantMsg);

    // Check stop reason
    if (response.stop_reason === 'end_turn' || response.stop_reason === 'stop_sequence') {
      // Send any text blocks to the group
      for (const block of response.content) {
        if (block.type === 'text' && block.text.trim()) {
          // Heartbeat: empty response = no-op (already filtered above by checking text)
          if (triggeredBy === 'heartbeat' && block.text.trim().length === 0) continue;
          await sendRateLimited(session, conversationId, block.text, groupReply);
        }
      }
      break;
    }

    if (response.stop_reason !== 'tool_use') break;

    // Execute tool calls
    const toolResults: MessageParam = {
      role: 'user',
      content: [],
    };

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      const toolBlock = block as ToolUseBlock;

      console.log(
        `[reason] tool_use: ${toolBlock.name} (session ${session.sessionId})`
      );

      let result: string;
      try {
        result = await handleToolCall(
          toolBlock.name,
          toolBlock.input as Record<string, unknown>,
          toolCtx
        );
      } catch (err) {
        result = `Tool error: ${String(err)}`;
        console.error(`[reason] tool error for ${toolBlock.name}:`, err);
      }

      (toolResults.content as any[]).push({
        type: 'tool_result',
        tool_use_id: toolBlock.id,
        content: result,
      });
    }

    if ((toolResults.content as any[]).length > 0) {
      messages.push(toolResults);
    }
  }

  if (rounds >= maxRounds) {
    console.warn(`[reason] max tool rounds reached for session ${session.sessionId}`);
    if (triggeredBy === 'xmtp_message') {
      await groupReply('I reached my reasoning limit for this request. Please try a simpler query.');
    }
  }

  // Heartbeat no-op: if no text was ever sent, log silently
  const sentAny = assistantParts.some((m) =>
    Array.isArray(m.content) &&
    m.content.some((b: any) => b.type === 'text' && b.text.trim())
  );
  if (triggeredBy === 'heartbeat' && !sentAny) {
    console.log(`[heartbeat] ${session.sessionId} ${org.powersAddress} — no action`);
  }

  // Update conversation history (trimmed to max turns).
  // Use `messages` directly — it already contains the full exchange including
  // tool_result user messages that must follow every tool_use assistant block.
  const maxTurns = config.ai.maxHistoryTurns * 2; // each turn = user + assistant
  let trimmed = messages.slice(-maxTurns);

  // Drop any leading orphaned tool_result or assistant blocks that the slice
  // may have cut off from their preceding context.
  while (trimmed.length > 0) {
    const first = trimmed[0];
    const isToolResult =
      Array.isArray(first.content) &&
      (first.content as any[])[0]?.type === 'tool_result';
    if (first.role === 'assistant' || isToolResult) {
      trimmed = trimmed.slice(1);
    } else {
      break;
    }
  }

  session.histories.set(conversationId, trimmed);

  sessionManager.touchSession(session.sessionId);
}

const MAX_REPLY_CHARS = 300;

async function sendRateLimited(
  session: AgentSession,
  conversationId: string,
  text: string,
  groupReply: (text: string) => Promise<void>
): Promise<void> {
  const truncated = text.length > MAX_REPLY_CHARS
    ? text.slice(0, MAX_REPLY_CHARS - 1) + '…'
    : text;
  const now = Date.now();
  const last = session.lastReplyAt.get(conversationId) ?? 0;
  const wait = Math.max(0, config.ai.chatRateLimitMs - (now - last));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  await groupReply(truncated);
  session.lastReplyAt.set(conversationId, Date.now());
}
