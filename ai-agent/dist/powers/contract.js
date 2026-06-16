import { createPublicClient, http, webSocket, } from 'viem';
import { config } from '../config/env.js';
import { powersAbi } from './abi.js';
const CHAIN_CONFIGS = {
    11155111: { name: 'sepolia', rpcUrl: config.rpcUrls.sepolia },
    84532: { name: 'base-sepolia', rpcUrl: config.rpcUrls.baseSepolia },
    11155420: { name: 'optimism-sepolia', rpcUrl: config.rpcUrls.optimismSepolia },
    421614: { name: 'arbitrum-sepolia', rpcUrl: config.rpcUrls.arbitrumSepolia },
    31337: { name: 'anvil', rpcUrl: 'http://127.0.0.1:8545' },
};
function httpToWss(url) {
    return url.replace(/^https:\/\//, 'wss://');
}
export function getRpcUrl(chainId) {
    const chain = CHAIN_CONFIGS[chainId];
    if (!chain?.rpcUrl)
        throw new Error(`No RPC URL for chainId ${chainId}`);
    return chain.rpcUrl;
}
export function getPublicClient(chainId) {
    const rpcUrl = getRpcUrl(chainId);
    return createPublicClient({ transport: http(rpcUrl) });
}
export function getWatchClient(chainId) {
    const rpcUrl = getRpcUrl(chainId);
    return createPublicClient({
        transport: webSocket(httpToWss(rpcUrl), {
            keepAlive: { interval: 30_000 },
            reconnect: { delay: 3_000, attempts: 10 },
        }),
    });
}
export async function isPowersContract(chainId, address) {
    try {
        const client = getPublicClient(chainId);
        const version = await client.readContract({
            address,
            abi: powersAbi,
            functionName: 'version',
        });
        return typeof version === 'string' && version.startsWith('v');
    }
    catch {
        return false;
    }
}
// ActionState enum values — must match PowersTypes.sol ActionState enum order exactly
export const ActionState = {
    NonExistent: 0,
    Proposed: 1,
    Cancelled: 2,
    Active: 3,
    Defeated: 4,
    Succeeded: 5,
    Requested: 6,
    Fulfilled: 7,
    Failed: 8,
};
export function actionStateLabel(state) {
    return (Object.entries(ActionState).find(([, v]) => v === state)?.[0] ?? 'Unknown');
}
export async function getMandateCounter(chainId, address) {
    const client = getPublicClient(chainId);
    const counter = await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getMandateCounter',
    });
    return Number(counter);
}
export async function getAllMandates(chainId, address) {
    const client = getPublicClient(chainId);
    const counter = await getMandateCounter(chainId, address);
    const mandates = [];
    for (let i = 1; i <= counter; i++) {
        try {
            const [targetMandate, , active] = (await client.readContract({
                address,
                abi: powersAbi,
                functionName: 'getAdoptedMandate',
                args: [i],
            }));
            const raw = (await client.readContract({
                address,
                abi: powersAbi,
                functionName: 'getConditions',
                args: [i],
            }));
            mandates.push({
                mandateId: i,
                targetMandate,
                active,
                conditions: {
                    allowedRole: raw.allowedRole,
                    votingPeriod: raw.votingPeriod,
                    timelock: BigInt(raw.timelock),
                    throttleExecution: BigInt(raw.throttleExecution),
                    needFulfilled: BigInt(raw.needFulfilled),
                    needNotFulfilled: BigInt(raw.needNotFulfilled),
                    quorum: raw.quorum,
                    succeedAt: raw.succeedAt,
                },
            });
        }
        catch (err) {
            console.error(`[contract] failed to fetch mandate ${i}:`, err);
        }
    }
    return mandates;
}
export async function getActionData(chainId, address, actionId) {
    const client = getPublicClient(chainId);
    const raw = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getActionData',
        args: [actionId],
    }));
    const state = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getActionState',
        args: [actionId],
    }));
    const calldata = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getActionCalldata',
        args: [actionId],
    }));
    return {
        actionId,
        mandateId: raw.mandateId,
        state,
        proposedAt: raw.proposedAt ?? 0n,
        requestedAt: raw.requestedAt ?? 0n,
        fulfilledAt: raw.fulfilledAt ?? 0n,
        cancelledAt: raw.cancelledAt ?? 0n,
        caller: raw.caller ?? '0x0',
        nonce: raw.nonce ?? 0n,
        calldata,
    };
}
export async function getActionVoteData(chainId, address, actionId) {
    const client = getPublicClient(chainId);
    const raw = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getActionVoteData',
        args: [actionId],
    }));
    return {
        voteStart: raw.voteStart,
        voteDuration: raw.voteDuration,
        voteEnd: raw.voteEnd,
        againstVotes: raw.againstVotes,
        forVotes: raw.forVotes,
        abstainVotes: raw.abstainVotes,
    };
}
export async function hasVoted(chainId, address, actionId, account) {
    const client = getPublicClient(chainId);
    return (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'hasVoted',
        args: [actionId, account],
    }));
}
export async function canCallMandate(chainId, address, caller, mandateId) {
    const client = getPublicClient(chainId);
    return (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'canCallMandate',
        args: [caller, mandateId],
    }));
}
export async function getAgentRoles(chainId, address, agentAddress) {
    const mandates = await getAllMandates(chainId, address);
    const uniqueRoles = new Set();
    const client = getPublicClient(chainId);
    for (const mandate of mandates) {
        const roleId = mandate.conditions.allowedRole;
        if (uniqueRoles.has(roleId))
            continue;
        try {
            const since = (await client.readContract({
                address,
                abi: powersAbi,
                functionName: 'hasRoleSince',
                args: [agentAddress, roleId],
            }));
            if (since > 0n)
                uniqueRoles.add(roleId);
        }
        catch {
            // role check failed — skip
        }
    }
    return Array.from(uniqueRoles);
}
export async function getFlows(chainId, address) {
    const client = getPublicClient(chainId);
    const count = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getFlowCount',
    }));
    const flows = [];
    for (let i = 0; i < Number(count); i++) {
        try {
            const mandateIds = (await client.readContract({
                address,
                abi: powersAbi,
                functionName: 'getFlowMandatesAtIndex',
                args: [i],
            }));
            const nameDescription = (await client.readContract({
                address,
                abi: powersAbi,
                functionName: 'getFlowDescriptionAtIndex',
                args: [i],
            }));
            flows.push({
                index: i,
                mandateIds: mandateIds.map((id) => BigInt(id)),
                nameDescription,
            });
        }
        catch (err) {
            console.error(`[contract] failed to fetch flow ${i}:`, err);
        }
    }
    return flows;
}
export async function getEthBalance(chainId, address) {
    const client = getPublicClient(chainId);
    return client.getBalance({ address });
}
export async function getCurrentBlock(chainId) {
    const client = getPublicClient(chainId);
    return client.getBlockNumber();
}
export async function getOpenActions(chainId, address, agentAddress) {
    const client = getPublicClient(chainId);
    const mandateCount = await getMandateCounter(chainId, address);
    const results = [];
    for (let mandateId = 1; mandateId <= mandateCount; mandateId++) {
        let actionCount;
        let timelock;
        try {
            actionCount = (await client.readContract({
                address,
                abi: powersAbi,
                functionName: 'getQuantityMandateActions',
                args: [mandateId],
            }));
            const raw = (await client.readContract({
                address,
                abi: powersAbi,
                functionName: 'getConditions',
                args: [mandateId],
            }));
            timelock = BigInt(raw.timelock);
        }
        catch (err) {
            console.error(`[contract] failed to fetch mandate ${mandateId} metadata:`, err);
            continue;
        }
        for (let idx = 0n; idx < actionCount; idx++) {
            try {
                const actionId = (await client.readContract({
                    address,
                    abi: powersAbi,
                    functionName: 'getMandateActionAtIndex',
                    args: [mandateId, idx],
                }));
                const data = (await getActionData(chainId, address, actionId));
                if (data.state !== ActionState.Active &&
                    data.state !== ActionState.Succeeded)
                    continue;
                const voteData = await getActionVoteData(chainId, address, actionId);
                const voted = await hasVoted(chainId, address, actionId, agentAddress);
                results.push({
                    ...data,
                    ...voteData,
                    readyToExecuteAt: BigInt(voteData.voteEnd) + BigInt(timelock),
                    hasAgentVoted: voted,
                });
            }
            catch (err) {
                console.error(`[contract] failed to fetch action at mandate ${mandateId} index ${idx}:`, err);
            }
        }
    }
    return results;
}
export async function getActionUri(chainId, address, actionId) {
    const client = getPublicClient(chainId);
    return (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getActionUri',
        args: [actionId],
    }));
}
export async function getOrgName(chainId, address) {
    const client = getPublicClient(chainId);
    return (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'name',
    }));
}
export async function getOrgUri(chainId, address) {
    const client = getPublicClient(chainId);
    return (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'uri',
    }));
}
// PUBLIC_ROLE is type(uint256).max — skip it, everyone has it and it has no meaningful label.
const PUBLIC_ROLE = (2n ** 256n) - 1n;
// Approximate block time per chain in seconds, used to estimate a block range for getLogs.
// Arbitrum produces ~4 blocks/s; capping at 200 000 blocks avoids RPC range rejections.
const BLOCKS_PER_DAY = {
    11155111: 7200n, // Sepolia: ~12s/block
    11155420: 43200n, // Optimism Sepolia: ~2s/block
    421614: 6667n, // Arbitrum Sepolia: capped (~14h worth)
    31337: 0n, // Anvil: start from block 0
};
function estimateBlockDaysAgo(chainId, daysBack, currentBlock) {
    const blocksPerDay = BLOCKS_PER_DAY[chainId] ?? 7200n;
    const blocksBack = blocksPerDay * BigInt(daysBack);
    return blocksBack >= currentBlock ? 0n : currentBlock - blocksBack;
}
export async function getActionHistory(chainId, address, daysBack = 30) {
    const client = getPublicClient(chainId);
    const currentBlock = await client.getBlockNumber();
    const fromBlock = estimateBlockDaysAgo(chainId, daysBack, currentBlock);
    const [createdEvents, fulfilledEvents, cancelledEvents] = await Promise.all([
        client.getContractEvents({
            address,
            abi: powersAbi,
            eventName: 'ProposedActionCreated',
            fromBlock,
            toBlock: currentBlock,
        }),
        client.getContractEvents({
            address,
            abi: powersAbi,
            eventName: 'ActionFulfilled',
            fromBlock,
            toBlock: currentBlock,
        }),
        client.getContractEvents({
            address,
            abi: powersAbi,
            eventName: 'ProposedActionCancelled',
            fromBlock,
            toBlock: currentBlock,
        }),
    ]);
    const historyMap = new Map();
    for (const ev of createdEvents) {
        const args = ev.args;
        historyMap.set(args.actionId.toString(), {
            actionId: args.actionId,
            mandateId: args.mandateId,
            caller: args.caller,
            proposedAt: ev.blockNumber ?? 0n,
            description: args.description ?? '',
            state: 'Active',
        });
    }
    for (const ev of fulfilledEvents) {
        const args = ev.args;
        const entry = historyMap.get(args.actionId.toString());
        if (entry)
            entry.state = 'Fulfilled';
    }
    for (const ev of cancelledEvents) {
        const args = ev.args;
        const entry = historyMap.get(args.actionId.toString());
        if (entry)
            entry.state = 'Cancelled';
    }
    // Resolve true state for any action still marked Active (could be Succeeded or Defeated).
    const stillActive = Array.from(historyMap.values()).filter((a) => a.state === 'Active');
    await Promise.all(stillActive.map(async (action) => {
        try {
            const state = (await client.readContract({
                address,
                abi: powersAbi,
                functionName: 'getActionState',
                args: [action.actionId],
            }));
            if (state === ActionState.Succeeded)
                action.state = 'Succeeded';
            else if (state === ActionState.Defeated)
                action.state = 'Defeated';
            else if (state === ActionState.Fulfilled)
                action.state = 'Fulfilled';
            else if (state === ActionState.Cancelled)
                action.state = 'Cancelled';
        }
        catch (err) {
            console.error(`[contract] failed to resolve state for action ${action.actionId}:`, err);
        }
    }));
    return Array.from(historyMap.values()).sort((a, b) => b.proposedAt > a.proposedAt ? 1 : b.proposedAt < a.proposedAt ? -1 : 0);
}
export async function getAmountRoleHolders(chainId, address, roleId) {
    const client = getPublicClient(chainId);
    return (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getAmountRoleHolders',
        args: [roleId],
    }));
}
export async function getRoleHolderAtIndex(chainId, address, roleId, index) {
    const client = getPublicClient(chainId);
    return (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getRoleHolderAtIndex',
        args: [roleId, index],
    }));
}
export async function getAllRoleInfo(chainId, address, mandates) {
    const client = getPublicClient(chainId);
    const uniqueRoleIds = new Set();
    for (const mandate of mandates) {
        const roleId = mandate.conditions.allowedRole;
        if (roleId !== PUBLIC_ROLE)
            uniqueRoleIds.add(roleId);
    }
    const roleInfoMap = new Map();
    await Promise.all(Array.from(uniqueRoleIds).map(async (roleId) => {
        try {
            const [label, metadata] = await Promise.all([
                client.readContract({
                    address,
                    abi: powersAbi,
                    functionName: 'getRoleLabel',
                    args: [roleId],
                }),
                client.readContract({
                    address,
                    abi: powersAbi,
                    functionName: 'getRoleMetadata',
                    args: [roleId],
                }),
            ]);
            roleInfoMap.set(roleId.toString(), { roleId, label, metadata });
        }
        catch (err) {
            console.error(`[contract] failed to fetch role info for ${roleId}:`, err);
        }
    }));
    return roleInfoMap;
}
