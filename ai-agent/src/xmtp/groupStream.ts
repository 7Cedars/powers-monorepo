import type { AgentSession, OrganisationConfig } from '../agent/AgentSession.js';
import { sessionManager } from '../agent/SessionManager.js';
import { parseGroupName } from './groupAccess.js';

export type ReasonFn = (
  session: AgentSession,
  org: OrganisationConfig,
  conversationId: string,
  triggerText: string,
  groupReply: (text: string) => Promise<void>
) => Promise<void>;

export function startGroupStream(
  session: AgentSession,
  reason: ReasonFn
): void {
  if (!session.xmtpClient) {
    console.warn(`[groupStream] no xmtp client for session ${session.sessionId}`);
    return;
  }

  const client = session.xmtpClient.client;

  (async () => {
    while (true) {
      try {
        const stream = await client.conversations.streamAllMessages();

        for await (const message of stream) {
          try {
            // Skip messages sent by this agent itself
            if (
              message.senderInboxId.toLowerCase() ===
              client.inboxId?.toLowerCase()
            ) {
              continue;
            }

            const conversation = await client.conversations.getConversationById(
              message.conversationId
            );
            if (!conversation) continue;

            // Only handle group messages
            const convType = (conversation as any).conversationType;
            if (convType !== 'group') continue;

            const groupName: string =
              (conversation as any).name ??
              (conversation as any).description ??
              '';

            // Only handle groups that belong to a whitelisted organisation
            const parsed = parseGroupName(groupName);
            if (!parsed) continue;

            const matchedOrg = session.organisations.find(
              (org) =>
                org.chainId === parsed.chainId &&
                org.powersAddress.toLowerCase() ===
                  parsed.powersAddress.toLowerCase()
            );
            if (!matchedOrg) continue;

            const text =
              typeof message.content === 'string' ? message.content : '';
            if (!text.trim()) continue;

            const groupReply = async (replyText: string): Promise<void> => {
              const now = Date.now();
              const last =
                session.lastReplyAt.get(message.conversationId) ?? 0;
              const wait = Math.max(0, 3000 - (now - last));
              if (wait > 0) {
                await new Promise((r) => setTimeout(r, wait));
              }
              await (conversation as any).sendText(replyText);
              session.lastReplyAt.set(message.conversationId, Date.now());
            };

            if (text.length > 300) {
              await groupReply('Message too long. Please keep messages under 300 characters.');
              continue;
            }

            await reason(session, matchedOrg, message.conversationId, text, groupReply);
            sessionManager.touchSession(session.sessionId);
          } catch (err) {
            console.error(
              `[groupStream] message handling error (session ${session.sessionId}):`,
              err
            );
          }
        }
      } catch (err) {
        console.error(
          `[groupStream] stream error for session ${session.sessionId}, restarting in 5s:`,
          err
        );
        await new Promise((r) => setTimeout(r, 5_000));
      }
    }
  })();
}
