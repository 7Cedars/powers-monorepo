import type { AgentSession } from '../agent/AgentSession.js';
import { getSessionGroups } from './groupAccess.js';

const BACKFILL_LIMIT = 60;

export async function backfillGroupChatHistory(session: AgentSession): Promise<void> {
  if (!session.xmtpClient) return;

  let groups: any[];
  try {
    groups = await getSessionGroups(session);
  } catch (err) {
    console.error(`[chatHistory] failed to list groups for session ${session.sessionId}:`, err);
    return;
  }

  if (groups.length === 0) {
    console.log(`[chatHistory] no groups to backfill for session ${session.sessionId}`);
    return;
  }

  await Promise.all(
    groups.map(async (group) => {
      const conversationId: string = group.id ?? group.conversationId;
      if (!conversationId) return;

      // Don't overwrite history from an already-active conversation.
      if (session.histories.has(conversationId)) return;

      try {
        await group.sync();
        // direction: 1 = Descending (newest first), then reverse for chronological order.
        const messages: any[] = await group.messages({ limit: BACKFILL_LIMIT, direction: 1 });
        const chronological = [...messages].reverse();

        const textLines = chronological
          .map((msg: any) => {
            const text = typeof msg.content === 'string' ? msg.content.trim() : null;
            if (!text) return null;
            const ts = msg.sentAt instanceof Date
              ? msg.sentAt.toISOString()
              : new Date(Number(msg.sentAtNs / 1_000_000n)).toISOString();
            return `${ts} ${msg.senderInboxId}: ${text}`;
          })
          .filter((l): l is string => l !== null);

        if (textLines.length === 0) return;

        const primingContent =
          `[CHAT HISTORY — last ${textLines.length} messages, loaded at startup]\n` +
          textLines.join('\n');

        session.histories.set(conversationId, [
          { role: 'user', content: primingContent },
          { role: 'assistant', content: '[Context loaded.]' },
        ]);

        console.log(
          `[chatHistory] backfilled ${textLines.length} messages for group ${conversationId} (session ${session.sessionId})`
        );
      } catch (err) {
        console.error(
          `[chatHistory] failed to backfill group ${conversationId} (session ${session.sessionId}):`,
          err
        );
      }
    })
  );
}
