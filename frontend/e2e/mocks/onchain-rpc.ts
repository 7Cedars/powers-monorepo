import type { Page } from '@playwright/test';
import {
  decodeFunctionData,
  encodeFunctionResult,
  encodeEventTopics,
  encodeAbiParameters,
  type Hex,
} from 'viem';

// Canonical Multicall3 address used by viem's default chain configs (sepolia,
// arbitrumSepolia, etc). wagmi's `useReadContracts` always batches through
// this contract when it's available on the chain, so any RPC mock that wants
// to answer `hasRoleSince` reads has to unwrap `aggregate3` calls too.
const MULTICALL3_ADDRESS = '0xca11bde05977b3631167028862be2a173976ca11';

const multicall3Abi = [
  {
    type: 'function',
    name: 'aggregate3',
    stateMutability: 'view',
    inputs: [
      {
        name: 'calls',
        type: 'tuple[]',
        components: [
          { name: 'target', type: 'address' },
          { name: 'allowFailure', type: 'bool' },
          { name: 'callData', type: 'bytes' },
        ],
      },
    ],
    outputs: [
      {
        name: 'returnData',
        type: 'tuple[]',
        components: [
          { name: 'success', type: 'bool' },
          { name: 'returnData', type: 'bytes' },
        ],
      },
    ],
  },
] as const;

const hasRoleSinceAbi = [
  {
    type: 'function',
    name: 'hasRoleSince',
    stateMutability: 'view',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'roleId', type: 'uint256' },
    ],
    outputs: [{ name: 'since', type: 'uint48' }],
  },
] as const;

const voteCastAbi = [
  {
    type: 'event',
    name: 'VoteCast',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'actionId', type: 'uint256', indexed: true },
      { name: 'support', type: 'uint8', indexed: true },
      { name: 'reason', type: 'string', indexed: false },
    ],
  },
] as const;

export type RoleGrant = {
  contractAddress: string;
  account: string;
  roleId: string | bigint;
  since: string | bigint;
};

export type VoteCast = {
  contractAddress: string;
  account: string;
  actionId: string | bigint;
  support?: number;
  reason?: string;
  blockNumber?: string | bigint;
};

type MockOnChainRpcOptions = {
  roleGrants?: RoleGrant[];
  votes?: VoteCast[];
  chainIdHex?: string;
};

function findSince(roleGrants: RoleGrant[], target: string, account: string, roleId: bigint): bigint {
  const match = roleGrants.find(
    (g) =>
      g.contractAddress.toLowerCase() === target.toLowerCase() &&
      g.account.toLowerCase() === account.toLowerCase() &&
      BigInt(g.roleId) === roleId
  );
  return match ? BigInt(match.since) : 0n;
}

function encodeHasRoleSinceResult(since: bigint): Hex {
  return encodeFunctionResult({ abi: hasRoleSinceAbi, functionName: 'hasRoleSince', result: Number(since) });
}

function handleEthCall(roleGrants: RoleGrant[], to: string | undefined, data: Hex | undefined): Hex {
  if (!to || !data) return '0x';

  if (to.toLowerCase() === MULTICALL3_ADDRESS) {
    try {
      const { args } = decodeFunctionData({ abi: multicall3Abi, data });
      const calls = args[0];
      const returnData = calls.map((call) => {
        try {
          const decoded = decodeFunctionData({ abi: hasRoleSinceAbi, data: call.callData });
          const since = findSince(roleGrants, call.target, decoded.args[0] as string, decoded.args[1] as bigint);
          return { success: true, returnData: encodeHasRoleSinceResult(since) };
        } catch (err) {
          console.error('[mockOnChainRpc] failed to decode hasRoleSince call', call.target, call.callData, err);
          return { success: true, returnData: '0x' as Hex };
        }
      });
      return encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: returnData });
    } catch (err) {
      console.error('[mockOnChainRpc] failed to decode aggregate3 multicall', data, err);
      return '0x';
    }
  }

  try {
    const decoded = decodeFunctionData({ abi: hasRoleSinceAbi, data });
    const since = findSince(roleGrants, to, decoded.args[0] as string, decoded.args[1] as bigint);
    return encodeHasRoleSinceResult(since);
  } catch (err) {
    console.error('[mockOnChainRpc] failed to decode direct hasRoleSince call', to, data, err);
    return '0x';
  }
}

function matchesTopics(requestTopics: unknown, logTopics: readonly (Hex | Hex[] | null)[]): boolean {
  if (!Array.isArray(requestTopics)) return true;
  return requestTopics.every((rt: unknown, i: number) => {
    if (rt == null) return true;
    const topic = logTopics[i];
    if (typeof topic !== 'string') return false;
    if (Array.isArray(rt)) return rt.some((t) => typeof t === 'string' && t.toLowerCase() === topic.toLowerCase());
    return typeof rt === 'string' && rt.toLowerCase() === topic.toLowerCase();
  });
}

function handleEthGetLogs(votes: VoteCast[], filter: any): unknown[] {
  const address = filter?.address;
  if (!address) return [];
  const addresses = (Array.isArray(address) ? address : [address]).map((a: string) => a.toLowerCase());

  return votes
    .filter((v) => addresses.includes(v.contractAddress.toLowerCase()))
    .map((v, i) => {
      const topics = encodeEventTopics({
        abi: voteCastAbi,
        eventName: 'VoteCast',
        args: { account: v.account as Hex, actionId: BigInt(v.actionId), support: v.support ?? 1 },
      });
      if (!matchesTopics(filter?.topics, topics)) return null;
      return {
        address: v.contractAddress,
        topics,
        data: encodeAbiParameters([{ type: 'string' }], [v.reason ?? '']),
        blockNumber: `0x${BigInt(v.blockNumber ?? 1).toString(16)}`,
        transactionHash: `0x${(i + 1).toString(16).padStart(64, '0')}`,
        transactionIndex: '0x0',
        blockHash: `0x${(i + 1).toString(16).padStart(64, '0')}`,
        logIndex: `0x${i.toString(16)}`,
        removed: false,
      };
    })
    .filter((log): log is NonNullable<typeof log> => log !== null);
}

// Stubs the Alchemy JSON-RPC endpoint so `useReadContracts`/`hasRoleSince`
// checks (Roles + Inbox sections) and `getContractEvents` VoteCast lookups
// (profile vote stats) resolve from in-memory fixtures instead of hitting the
// network. Reusable across any e2e spec that needs role- or vote-aware
// on-chain reads without re-deriving the multicall/log decoding by hand.
export async function mockOnChainRpc(page: Page, options: MockOnChainRpcOptions = {}) {
  const { roleGrants = [], votes = [], chainIdHex = '0xaa36a7' } = options;

  await page.routeWebSocket(/g\.alchemy\.com/, (ws) => ws.close());
  await page.route(/g\.alchemy\.com\/v2\//, async (route) => {
    let body: unknown;
    try {
      body = JSON.parse(route.request().postData() ?? '{}');
    } catch {
      body = {};
    }

    const toResult = (entry: any) => {
      switch (entry?.method) {
        case 'eth_blockNumber':
          return { jsonrpc: '2.0', id: entry?.id, result: '0x64' };
        case 'eth_chainId':
          return { jsonrpc: '2.0', id: entry?.id, result: chainIdHex };
        case 'eth_getLogs':
          return { jsonrpc: '2.0', id: entry?.id, result: handleEthGetLogs(votes, entry?.params?.[0]) };
        case 'eth_call':
          return {
            jsonrpc: '2.0',
            id: entry?.id,
            result: handleEthCall(roleGrants, entry?.params?.[0]?.to, entry?.params?.[0]?.data),
          };
        default:
          return { jsonrpc: '2.0', id: entry?.id, result: '0x' };
      }
    };

    const payload = Array.isArray(body) ? body.map(toResult) : toResult(body);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
  });
}
