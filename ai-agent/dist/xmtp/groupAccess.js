import { Client } from '@xmtp/agent-sdk';
import { canCallMandate, getAllMandates, getFlows } from '../powers/contract.js';
export function getGroupName(type, chainId, powersAddress, contextId) {
    return `${type}-${chainId}-${powersAddress}-${contextId}`;
}
export function parseGroupName(name) {
    const parts = name.split('-');
    if (parts.length !== 4)
        return null;
    const [type, chainIdStr, powersAddress, contextIdStr] = parts;
    if (!['Mandate', 'Flow', 'Action'].includes(type))
        return null;
    const chainId = parseInt(chainIdStr, 10);
    if (isNaN(chainId))
        return null;
    return {
        type: type,
        chainId,
        powersAddress: powersAddress,
        contextId: BigInt(contextIdStr),
    };
}
export async function joinGroupIfEligible(session, groupName) {
    if (!session.xmtpClient)
        return false;
    const parsed = parseGroupName(groupName);
    if (!parsed)
        return false;
    const { type, chainId, powersAddress, contextId } = parsed;
    if (type !== 'Mandate')
        return false;
    const eligible = await canCallMandate(chainId, powersAddress, session.userAddress, Number(contextId));
    if (!eligible)
        return false;
    await session.xmtpClient.client.conversations.sync();
    const convos = await session.xmtpClient.client.conversations.list();
    const existing = convos.find((c) => c.name === groupName || c.description === groupName);
    if (existing)
        return true; // already a member
    console.log(`[xmtp] session ${session.sessionId} joining group ${groupName}`);
    // Group joins are initiated by the org bot; agent can join by responding to an invite
    // or by having been added. We sync here and rely on the org bot (xmtp-agent) to add us.
    return false;
}
export async function getSessionGroups(session) {
    if (!session.xmtpClient)
        return [];
    try {
        await session.xmtpClient.client.conversations.sync();
        const convos = await session.xmtpClient.client.conversations.list();
        return convos.filter((c) => c.conversationType === 'group');
    }
    catch (err) {
        console.error(`[xmtp] failed to list groups for session ${session.sessionId}:`, err);
        return [];
    }
}
export async function findGroup(session, groupName) {
    const groups = await getSessionGroups(session);
    return (groups.find((g) => g.name === groupName ||
        g.groupName === groupName ||
        g.description === groupName) ?? null);
}
export async function requestOrgGroupAccess(session, org) {
    if (!session.xmtpClient)
        return;
    if (!org.xmtpAgentAddress)
        return;
    let mandates;
    try {
        mandates = await getAllMandates(org.chainId, org.powersAddress);
    }
    catch (err) {
        console.error(`[xmtp] failed to fetch mandates for ${org.powersAddress} (session ${session.sessionId}):`, err);
        return;
    }
    for (const mandate of mandates.filter((m) => m.active)) {
        try {
            const eligible = await canCallMandate(org.chainId, org.powersAddress, session.userAddress, mandate.mandateId);
            if (!eligible)
                continue;
            const groupName = getGroupName('Mandate', org.chainId, org.powersAddress, BigInt(mandate.mandateId));
            const existing = await findGroup(session, groupName);
            if (existing)
                continue;
            const dm = await session.xmtpClient.createDmWithAddress(org.xmtpAgentAddress);
            await dm.sendText(groupName);
            console.log(`[xmtp] requested access to group ${groupName} via DM to ${org.xmtpAgentAddress} (session ${session.sessionId})`);
        }
        catch (err) {
            console.error(`[xmtp] failed to request access for mandate ${mandate.mandateId} (session ${session.sessionId}):`, err);
        }
    }
    // Flow groups
    let flows = [];
    try {
        flows = await getFlows(org.chainId, org.powersAddress);
    }
    catch (err) {
        console.error(`[xmtp] failed to fetch flows for ${org.powersAddress} (session ${session.sessionId}):`, err);
    }
    for (const flow of flows) {
        if (flow.mandateIds.length === 0)
            continue;
        try {
            let eligibleForFlow = false;
            for (const mandateId of flow.mandateIds) {
                if (await canCallMandate(org.chainId, org.powersAddress, session.userAddress, Number(mandateId))) {
                    eligibleForFlow = true;
                    break;
                }
            }
            if (!eligibleForFlow)
                continue;
            const groupName = getGroupName('Flow', org.chainId, org.powersAddress, flow.mandateIds[0]);
            const existing = await findGroup(session, groupName);
            if (existing)
                continue;
            const dm = await session.xmtpClient.createDmWithAddress(org.xmtpAgentAddress);
            await dm.sendText(groupName);
            console.log(`[xmtp] requested access to flow group ${groupName} via DM to ${org.xmtpAgentAddress} (session ${session.sessionId})`);
        }
        catch (err) {
            console.error(`[xmtp] failed to request access for flow group ${flow.index} (session ${session.sessionId}):`, err);
        }
    }
}
export async function canAddressReceiveXmtp(address) {
    try {
        const map = await Client.canMessage([
            { identifier: address.toLowerCase(), identifierKind: 0 /* IdentifierKind.Ethereum */ },
        ]);
        return map.get(address.toLowerCase()) ?? false;
    }
    catch {
        return false;
    }
}
