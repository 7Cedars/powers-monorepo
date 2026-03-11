import { ChatMessageData } from '@/components/ChatMessage';

/**
 * Generate a deterministic anchor hash from a chat message.
 * Uses the Web Crypto API to produce a SHA-256 hash of a canonical snapshot.
 */
export async function generateAnchorHash(message: ChatMessageData, chatroomContext: string): Promise<string> {
  const snapshot = {
    messageId: message.id,
    sender: message.sender,
    address: message.address,
    message: message.message,
    timestamp: message.timestamp.toISOString(),
    role: message.role || null,
    chatroom: chatroomContext,
  };

  const canonical = JSON.stringify(snapshot, Object.keys(snapshot).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Return a prefixed, truncated hash for usability
  return `0x${hashHex.slice(0, 40)}`;
}
