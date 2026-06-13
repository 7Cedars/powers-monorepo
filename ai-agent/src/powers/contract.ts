import {
  createPublicClient,
  http,
  webSocket,
  type Address,
  type PublicClient,
} from 'viem';
import { config } from '../config/env.js';
import { powersAbi } from './abi.js';

const CHAIN_CONFIGS: Record<number, { name: string; rpcUrl: string | undefined }> = {
  11155111: { name: 'sepolia', rpcUrl: config.rpcUrls.sepolia },
  84532: { name: 'base-sepolia', rpcUrl: config.rpcUrls.baseSepolia },
  11155420: { name: 'optimism-sepolia', rpcUrl: config.rpcUrls.optimismSepolia },
  421614: { name: 'arbitrum-sepolia', rpcUrl: config.rpcUrls.arbitrumSepolia },
  31337: { name: 'anvil', rpcUrl: 'http://127.0.0.1:8545' },
};

function httpToWss(url: string): string {
  return url.replace(/^https:\/\//, 'wss://');
}

export function getRpcUrl(chainId: number): string {
  const chain = CHAIN_CONFIGS[chainId];
  if (!chain?.rpcUrl) throw new Error(`No RPC URL for chainId ${chainId}`);
  return chain.rpcUrl;
}

export function getPublicClient(chainId: number): PublicClient {
  const rpcUrl = getRpcUrl(chainId);
  return createPublicClient({ transport: http(rpcUrl) });
}

export function getWatchClient(chainId: number): PublicClient {
  const rpcUrl = getRpcUrl(chainId);
  return createPublicClient({
    transport: webSocket(httpToWss(rpcUrl), {
      keepAlive: { interval: 30_000 },
      reconnect: { delay: 3_000, attempts: 10 },
    }),
  });
}

export async function isPowersContract(
  chainId: number,
  address: Address
): Promise<boolean> {
  try {
    const client = getPublicClient(chainId);
    const version = await client.readContract({
      address,
      abi: powersAbi,
      functionName: 'version',
    });
    return typeof version === 'string' && version.startsWith('v');
  } catch {
    return false;
  }
}

export interface MandateConditions {
  allowedRole: bigint;
  votingPeriod: number;
  timelock: bigint;
  throttleExecution: bigint;
  needFulfilled: bigint;
  needNotFulfilled: bigint;
  quorum: number;
  succeedAt: number;
}

export interface MandateData {
  mandateId: number;
  targetMandate: Address;
  active: boolean;
  conditions: MandateConditions;
}

export interface ActionData {
  actionId: bigint;
  mandateId: number;
  state: number;
  proposedAt: bigint;
  requestedAt: bigint;
  fulfilledAt: bigint;
  cancelledAt: bigint;
  caller: Address;
  nonce: bigint;
}

export interface ActionVoteData {
  voteStart: number;
  voteDuration: number;
  voteEnd: bigint;
  againstVotes: number;
  forVotes: number;
  abstainVotes: number;
}

export interface FlowData {
  index: number;
  mandateIds: bigint[];
  nameDescription: string;
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
} as const;

export function actionStateLabel(state: number): string {
  return (
    Object.entries(ActionState).find(([, v]) => v === state)?.[0] ?? 'Unknown'
  );
}

export async function getMandateCounter(
  chainId: number,
  address: Address
): Promise<number> {
  const client = getPublicClient(chainId);
  const counter = await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getMandateCounter',
  });
  return Number(counter);
}

export async function getAllMandates(
  chainId: number,
  address: Address
): Promise<MandateData[]> {
  const client = getPublicClient(chainId);
  const counter = await getMandateCounter(chainId, address);
  const mandates: MandateData[] = [];

  for (let i = 1; i <= counter; i++) {
    try {
      const [targetMandate, , active] = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getAdoptedMandate',
        args: [i],
      })) as [Address, bigint, boolean];

      const raw = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getConditions',
        args: [i],
      })) as {
        allowedRole: bigint;
        votingPeriod: number;
        timelock: number;
        throttleExecution: number;
        needFulfilled: number;
        needNotFulfilled: number;
        quorum: number;
        succeedAt: number;
      };

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
    } catch (err) {
      console.error(`[contract] failed to fetch mandate ${i}:`, err);
    }
  }

  return mandates;
}


export async function getActionData(
  chainId: number,
  address: Address,
  actionId: bigint
): Promise<ActionData> {
  const client = getPublicClient(chainId);
  // getActionData returns multiple named outputs — viem decodes these as an array
  const [mandateId, proposedAt, requestedAt, fulfilledAt, cancelledAt, caller, nonce] =
    (await client.readContract({
      address,
      abi: powersAbi,
      functionName: 'getActionData',
      args: [actionId],
    })) as [number, bigint, bigint, bigint, bigint, Address, bigint];

  const state = (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getActionState',
    args: [actionId],
  })) as number;

  const calldata = (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getActionCalldata',
    args: [actionId],
  })) as `0x${string}`;

  return {
    actionId,
    mandateId,
    state,
    proposedAt: proposedAt ?? 0n,
    requestedAt: requestedAt ?? 0n,
    fulfilledAt: fulfilledAt ?? 0n,
    cancelledAt: cancelledAt ?? 0n,
    caller: caller ?? '0x0',
    nonce: nonce ?? 0n,
    calldata,
  } as ActionData & { calldata: `0x${string}` };
}

export async function getActionVoteData(
  chainId: number,
  address: Address,
  actionId: bigint
): Promise<ActionVoteData> {
  const client = getPublicClient(chainId);
  // getActionVoteData returns multiple named outputs — viem decodes these as an array
  const [voteStart, voteDuration, voteEnd, againstVotes, forVotes, abstainVotes] =
    (await client.readContract({
      address,
      abi: powersAbi,
      functionName: 'getActionVoteData',
      args: [actionId],
    })) as [number, number, bigint, number, number, number];

  return {
    voteStart,
    voteDuration,
    voteEnd,
    againstVotes,
    forVotes,
    abstainVotes,
  };
}

export async function hasVoted(
  chainId: number,
  address: Address,
  actionId: bigint,
  account: Address
): Promise<boolean> {
  const client = getPublicClient(chainId);
  return (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'hasVoted',
    args: [actionId, account],
  })) as boolean;
}

export async function canCallMandate(
  chainId: number,
  address: Address,
  caller: Address,
  mandateId: number
): Promise<boolean> {
  const client = getPublicClient(chainId);
  return (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'canCallMandate',
    args: [caller, mandateId],
  })) as boolean;
}

export async function getAgentRoles(
  chainId: number,
  address: Address,
  agentAddress: Address
): Promise<bigint[]> {
  const mandates = await getAllMandates(chainId, address);
  const uniqueRoles = new Set<bigint>();
  const client = getPublicClient(chainId);

  for (const mandate of mandates) {
    const roleId = mandate.conditions.allowedRole;
    if (uniqueRoles.has(roleId)) continue;
    try {
      const since = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'hasRoleSince',
        args: [agentAddress, roleId],
      })) as bigint;
      if (since > 0n) uniqueRoles.add(roleId);
    } catch {
      // role check failed — skip
    }
  }

  return Array.from(uniqueRoles);
}

export async function getFlows(
  chainId: number,
  address: Address
): Promise<FlowData[]> {
  const client = getPublicClient(chainId);
  const count = (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getFlowCount',
  })) as bigint;

  const flows: FlowData[] = [];
  for (let i = 0; i < Number(count); i++) {
    try {
      const mandateIds = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getFlowMandatesAtIndex',
        args: [i],
      })) as number[];

      const nameDescription = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getFlowDescriptionAtIndex',
        args: [i],
      })) as string;

      flows.push({
        index: i,
        mandateIds: mandateIds.map((id) => BigInt(id)),
        nameDescription,
      });
    } catch (err) {
      console.error(`[contract] failed to fetch flow ${i}:`, err);
    }
  }

  return flows;
}

export async function getEthBalance(
  chainId: number,
  address: Address
): Promise<bigint> {
  const client = getPublicClient(chainId);
  return client.getBalance({ address });
}

export async function getCurrentBlock(chainId: number): Promise<bigint> {
  const client = getPublicClient(chainId);
  return client.getBlockNumber();
}

export async function getOpenActions(
  chainId: number,
  address: Address,
  agentAddress: Address
): Promise<
  Array<
    ActionData &
      ActionVoteData & {
        readyToExecuteAt: bigint;
        hasAgentVoted: boolean;
        calldata: `0x${string}`;
      }
  >
> {
  const client = getPublicClient(chainId);
  const mandateCount = await getMandateCounter(chainId, address);
  const results = [];

  for (let mandateId = 1; mandateId <= mandateCount; mandateId++) {
    let actionCount: bigint;
    let timelock: bigint;

    try {
      actionCount = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getQuantityMandateActions',
        args: [mandateId],
      })) as bigint;

      const raw = (await client.readContract({
        address,
        abi: powersAbi,
        functionName: 'getConditions',
        args: [mandateId],
      })) as { timelock: number };
      timelock = BigInt(raw.timelock);
    } catch (err) {
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
        })) as bigint;

        const data = (await getActionData(chainId, address, actionId)) as ActionData & {
          calldata: `0x${string}`;
        };

        if (
          data.state !== ActionState.Active &&
          data.state !== ActionState.Succeeded
        )
          continue;

        const voteData = await getActionVoteData(chainId, address, actionId);
        const voted = await hasVoted(chainId, address, actionId, agentAddress);

        results.push({
          ...data,
          ...voteData,
          readyToExecuteAt: BigInt(voteData.voteEnd) + BigInt(timelock),
          hasAgentVoted: voted,
        });
      } catch (err) {
        console.error(`[contract] failed to fetch action at mandate ${mandateId} index ${idx}:`, err);
      }
    }
  }

  return results;
}

export async function getActionUri(
  chainId: number,
  address: Address,
  actionId: bigint
): Promise<string> {
  const client = getPublicClient(chainId);
  return (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getActionUri',
    args: [actionId],
  })) as string;
}

export async function getOrgName(chainId: number, address: Address): Promise<string> {
  const client = getPublicClient(chainId);
  return (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'name',
  })) as string;
}

export async function getOrgUri(chainId: number, address: Address): Promise<string> {
  const client = getPublicClient(chainId);
  return (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'uri',
  })) as string;
}

export interface RoleInfo {
  roleId: bigint;
  label: string;
  metadata: string;
}

// PUBLIC_ROLE is type(uint256).max — skip it, everyone has it and it has no meaningful label.
const PUBLIC_ROLE = (2n ** 256n) - 1n;

export interface HistoricalAction {
  actionId: bigint;
  mandateId: number;
  caller: Address;
  proposedAt: bigint;
  description: string;
  state: 'Active' | 'Succeeded' | 'Defeated' | 'Fulfilled' | 'Cancelled';
}

// Approximate block time per chain in seconds, used to estimate a block range for getLogs.
// Arbitrum produces ~4 blocks/s; capping at 200 000 blocks avoids RPC range rejections.
const BLOCKS_PER_DAY: Record<number, bigint> = {
  11155111: 7200n,   // Sepolia: ~12s/block
  11155420: 43200n,  // Optimism Sepolia: ~2s/block
  421614:   6667n,   // Arbitrum Sepolia: capped (~14h worth)
  31337:    0n,      // Anvil: start from block 0
};

function estimateBlockDaysAgo(chainId: number, daysBack: number, currentBlock: bigint): bigint {
  const blocksPerDay = BLOCKS_PER_DAY[chainId] ?? 7200n;
  const blocksBack = blocksPerDay * BigInt(daysBack);
  return blocksBack >= currentBlock ? 0n : currentBlock - blocksBack;
}

export async function getActionHistory(
  chainId: number,
  address: Address,
  daysBack = 30
): Promise<HistoricalAction[]> {
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

  const historyMap = new Map<string, HistoricalAction>();

  for (const ev of createdEvents) {
    const args = ev.args as {
      actionId: bigint;
      caller: Address;
      mandateId: number;
      description: string;
    };
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
    const args = ev.args as { actionId: bigint };
    const entry = historyMap.get(args.actionId.toString());
    if (entry) entry.state = 'Fulfilled';
  }

  for (const ev of cancelledEvents) {
    const args = ev.args as { actionId: bigint };
    const entry = historyMap.get(args.actionId.toString());
    if (entry) entry.state = 'Cancelled';
  }

  // Resolve true state for any action still marked Active (could be Succeeded or Defeated).
  const stillActive = Array.from(historyMap.values()).filter((a) => a.state === 'Active');
  await Promise.all(
    stillActive.map(async (action) => {
      try {
        const state = (await client.readContract({
          address,
          abi: powersAbi,
          functionName: 'getActionState',
          args: [action.actionId],
        })) as number;
        if (state === ActionState.Succeeded) action.state = 'Succeeded';
        else if (state === ActionState.Defeated) action.state = 'Defeated';
        else if (state === ActionState.Fulfilled) action.state = 'Fulfilled';
        else if (state === ActionState.Cancelled) action.state = 'Cancelled';
      } catch (err) {
        console.error(`[contract] failed to resolve state for action ${action.actionId}:`, err);
      }
    })
  );

  return Array.from(historyMap.values()).sort((a, b) =>
    b.proposedAt > a.proposedAt ? 1 : b.proposedAt < a.proposedAt ? -1 : 0
  );
}

export async function getAmountRoleHolders(
  chainId: number,
  address: Address,
  roleId: bigint
): Promise<bigint> {
  const client = getPublicClient(chainId);
  return (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getAmountRoleHolders',
    args: [roleId],
  })) as bigint;
}

export async function getRoleHolderAtIndex(
  chainId: number,
  address: Address,
  roleId: bigint,
  index: bigint
): Promise<Address> {
  const client = getPublicClient(chainId);
  return (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getRoleHolderAtIndex',
    args: [roleId, index],
  })) as Address;
}

export async function getAllRoleInfo(
  chainId: number,
  address: Address,
  mandates: MandateData[]
): Promise<Map<string, RoleInfo>> {
  const client = getPublicClient(chainId);
  const uniqueRoleIds = new Set<bigint>();

  for (const mandate of mandates) {
    const roleId = mandate.conditions.allowedRole;
    if (roleId !== PUBLIC_ROLE) uniqueRoleIds.add(roleId);
  }

  const roleInfoMap = new Map<string, RoleInfo>();

  await Promise.all(
    Array.from(uniqueRoleIds).map(async (roleId) => {
      try {
        const [label, metadata] = await Promise.all([
          client.readContract({
            address,
            abi: powersAbi,
            functionName: 'getRoleLabel',
            args: [roleId],
          }) as Promise<string>,
          client.readContract({
            address,
            abi: powersAbi,
            functionName: 'getRoleMetadata',
            args: [roleId],
          }) as Promise<string>,
        ]);
        roleInfoMap.set(roleId.toString(), { roleId, label, metadata });
      } catch (err) {
        console.error(`[contract] failed to fetch role info for ${roleId}:`, err);
      }
    })
  );

  return roleInfoMap;
}
