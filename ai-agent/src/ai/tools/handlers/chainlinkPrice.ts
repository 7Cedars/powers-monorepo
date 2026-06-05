import { createPublicClient, http } from 'viem';
import { getRpcUrl } from '../../../powers/contract.js';

// Minimal Chainlink AggregatorV3Interface ABI
const aggregatorAbi = [
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'description',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export async function chainlinkPrice(
  feedAddress: `0x${string}`,
  chainId: number
): Promise<string> {
  try {
    const client = createPublicClient({ transport: http(getRpcUrl(chainId)) });

    const [roundData, decimals, description] = await Promise.all([
      client.readContract({ address: feedAddress, abi: aggregatorAbi, functionName: 'latestRoundData' }),
      client.readContract({ address: feedAddress, abi: aggregatorAbi, functionName: 'decimals' }),
      client.readContract({ address: feedAddress, abi: aggregatorAbi, functionName: 'description' }),
    ]);

    const [, answer, , updatedAt] = roundData as [bigint, bigint, bigint, bigint, bigint];
    const dec = Number(decimals);
    const price = Number(answer) / Math.pow(10, dec);
    const updated = new Date(Number(updatedAt) * 1000).toISOString();

    return `${description}: ${price.toFixed(dec > 8 ? 8 : dec)} (updated ${updated})`;
  } catch (err) {
    return `Error reading Chainlink feed ${feedAddress}: ${String(err)}`;
  }
}
