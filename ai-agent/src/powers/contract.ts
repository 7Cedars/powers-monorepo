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
  voteStart: bigint;
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

// ActionState enum values
export const ActionState = {
  NonExistent: 0,
  Active: 1,
  Succeeded: 2,
  Defeated: 3,
  Failed: 4,
  Fulfilled: 5,
  Cancelled: 6,
  Requested: 7,
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

export async function getActionCounter(
  chainId: number,
  address: Address
): Promise<bigint> {
  const client = getPublicClient(chainId);
  return (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getActionCounter',
  })) as bigint;
}

export async function getActionData(
  chainId: number,
  address: Address,
  actionId: bigint
): Promise<ActionData> {
  const client = getPublicClient(chainId);
  const raw = (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getActionData',
    args: [actionId],
  })) as {
    mandateId: number;
    status?: number;
    proposedAt?: bigint;
    requestedAt?: bigint;
    fulfilledAt?: bigint;
    cancelledAt?: bigint;
    caller?: Address;
    nonce?: bigint;
  };

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
    mandateId: raw.mandateId,
    state,
    proposedAt: raw.proposedAt ?? 0n,
    requestedAt: raw.requestedAt ?? 0n,
    fulfilledAt: raw.fulfilledAt ?? 0n,
    cancelledAt: raw.cancelledAt ?? 0n,
    caller: (raw.caller as Address) ?? '0x0',
    nonce: raw.nonce ?? 0n,
    calldata,
  } as ActionData & { calldata: `0x${string}` };
}

export async function getActionVoteData(
  chainId: number,
  address: Address,
  actionId: bigint
): Promise<ActionVoteData> {
  const client = getPublicClient(chainId);
  const raw = (await client.readContract({
    address,
    abi: powersAbi,
    functionName: 'getActionVoteData',
    args: [actionId],
  })) as {
    voteStart: bigint;
    voteDuration: number;
    voteEnd: bigint;
    againstVotes: number;
    forVotes: number;
    abstainVotes: number;
  };

  return {
    voteStart: raw.voteStart,
    voteDuration: raw.voteDuration,
    voteEnd: raw.voteEnd,
    againstVotes: raw.againstVotes,
    forVotes: raw.forVotes,
    abstainVotes: raw.abstainVotes,
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
  const counter = await getActionCounter(chainId, address);
  const results = [];

  for (let i = 0n; i < counter; i++) {
    try {
      const data = (await getActionData(chainId, address, i)) as ActionData & {
        calldata: `0x${string}`;
      };
      // Only include active or succeeded (ready to execute) actions
      if (
        data.state !== ActionState.Active &&
        data.state !== ActionState.Succeeded
      )
        continue;

      const voteData = await getActionVoteData(chainId, address, i);
      const voted = await hasVoted(chainId, address, i, agentAddress);

      results.push({
        ...data,
        ...voteData,
        readyToExecuteAt: voteData.voteEnd + BigInt(
          (await getAllMandates(chainId, address)).find(
            (m) => m.mandateId === data.mandateId
          )?.conditions.timelock ?? 0n
        ),
        hasAgentVoted: voted,
      });
    } catch (err) {
      console.error(`[contract] failed to fetch action ${i}:`, err);
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
