import type { Address } from 'viem';
import type { Flow, Mandate } from '../utils/types.js';
import { getFlows } from './contract.js';

/**
 * Returns all on-chain flows that contain at least one of the target mandates.
 */
export async function getFlowsContainingMandates(
  chainId: number,
  contractAddress: Address,
  targetMandates: Mandate[]
): Promise<Flow[]> {
  const flows = await getFlows(chainId, contractAddress);
  const targetIds = new Set(targetMandates.map(m => m.index));

  return flows.filter(flow =>
    flow.mandateIds.some(id => targetIds.has(id))
  );
}
