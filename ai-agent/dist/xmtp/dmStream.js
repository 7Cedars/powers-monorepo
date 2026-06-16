import { verifyMessage } from 'viem';
import { parseGroupName, findGroup } from './groupAccess.js';
import { canCallMandate } from '../powers/contract.js';
export function startDmStream(session) {
    if (!session.xmtpClient) {
        console.warn(`[dmStream] no xmtp client for session ${session.sessionId}`);
        return;
    }
    const client = session.xmtpClient.client;
    (async () => {
        while (true) {
            try {
                const stream = await client.conversations.streamAllMessages();
                for await (const message of stream) {
                    try {
                        if (message.senderInboxId.toLowerCase() ===
                            client.inboxId?.toLowerCase()) {
                            continue;
                        }
                        const conversation = await client.conversations.getConversationById(message.conversationId);
                        if (!conversation)
                            continue;
                        const convType = conversation.conversationType;
                        if (convType !== 'dm')
                            continue;
                        const text = typeof message.content === 'string' ? message.content.trim() : '';
                        if (!text)
                            continue;
                        console.log(`[dmStream] access request from ${message.senderInboxId} (session ${session.sessionId}): ${text}`);
                        const dmReply = async (replyText) => {
                            await conversation.sendText(replyText);
                        };
                        await handleAccessRequest(session, client, message.senderInboxId, conversation, text, dmReply);
                    }
                    catch (err) {
                        console.error(`[dmStream] message handling error (session ${session.sessionId}):`, err);
                    }
                }
            }
            catch (err) {
                console.error(`[dmStream] stream error for session ${session.sessionId}, restarting in 5s:`, err);
                await new Promise((r) => setTimeout(r, 5_000));
            }
        }
    })();
}
async function handleAccessRequest(session, client, senderInboxId, conversation, text, dmReply) {
    let baseChatroomId;
    let requestingAddress;
    const pipeParts = text.split('|');
    if (pipeParts.length === 3) {
        // Smart wallet format: {baseChatroomId}|{effectiveAddress}|{signature}
        const [chatroomId, effectiveAddress, signature] = pipeParts;
        baseChatroomId = chatroomId;
        const eoaAddress = await getSenderEthAddress(conversation, senderInboxId);
        if (!eoaAddress) {
            await dmReply('Could not resolve your address. Please try again.');
            return;
        }
        try {
            const isValid = await verifyMessage({
                address: eoaAddress,
                message: `${baseChatroomId}:${effectiveAddress}`,
                signature: signature,
            });
            if (!isValid) {
                await dmReply('Invalid signature. Please use the Request Access button in the Powers app.');
                return;
            }
        }
        catch {
            await dmReply('Could not verify signature. Please try again.');
            return;
        }
        requestingAddress = effectiveAddress;
    }
    else {
        // Simple EOA format: {baseChatroomId}
        baseChatroomId = text;
        const eoaAddress = await getSenderEthAddress(conversation, senderInboxId);
        if (!eoaAddress) {
            await dmReply('Could not resolve your address. Please try again.');
            return;
        }
        requestingAddress = eoaAddress;
    }
    const parsed = parseGroupName(baseChatroomId);
    if (!parsed) {
        await dmReply('Invalid request format. Please use the Request Access button in the Powers app.');
        return;
    }
    const matchedOrg = session.organisations.find((org) => org.chainId === parsed.chainId &&
        org.powersAddress.toLowerCase() === parsed.powersAddress.toLowerCase());
    if (!matchedOrg) {
        await dmReply('This organisation is not managed by this agent.');
        return;
    }
    let hasAccess;
    try {
        hasAccess = await canCallMandate(parsed.chainId, parsed.powersAddress, requestingAddress, Number(parsed.contextId));
    }
    catch (err) {
        console.error('[dmStream] canCallMandate error:', err);
        await dmReply('Could not verify your on-chain access. Please try again later.');
        return;
    }
    if (!hasAccess) {
        await dmReply(`You don't have the required role to access this mandate chat.`);
        return;
    }
    try {
        let group = await findGroup(session, baseChatroomId);
        if (!group) {
            // Create the group with the requesting user as the first member alongside the agent
            group = await client.conversations.newGroup([{ identifier: requestingAddress.toLowerCase(), identifierKind: 0 /* IdentifierKind.Ethereum */ }], { groupName: baseChatroomId });
            console.log(`[dmStream] created group ${baseChatroomId} for session ${session.sessionId}`);
        }
        else {
            const members = await group.members();
            const alreadyMember = members.some((m) => m.inboxId === senderInboxId);
            if (alreadyMember) {
                await dmReply('You are already a member of this group chat.');
                return;
            }
            await group.addMembers([
                { identifier: requestingAddress.toLowerCase(), identifierKind: 0 /* IdentifierKind.Ethereum */ },
            ]);
            console.log(`[dmStream] added ${requestingAddress} to ${baseChatroomId} (session ${session.sessionId})`);
        }
        await dmReply(`You've been added to the group chat. You can now participate in discussions for this mandate.`);
    }
    catch (err) {
        console.error(`[dmStream] group management error for session ${session.sessionId}:`, err);
        await dmReply('Failed to add you to the group. Please try again or contact the administrator.');
    }
}
async function getSenderEthAddress(conversation, senderInboxId) {
    try {
        const members = await conversation.members();
        const sender = members.find((m) => m.inboxId === senderInboxId);
        if (!sender)
            return null;
        return (sender.accountIdentifiers?.[0]?.identifier ??
            sender.accountAddress ??
            null);
    }
    catch {
        return null;
    }
}
