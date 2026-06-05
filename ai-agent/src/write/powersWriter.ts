import {
  createWalletClient,
  createPublicClient,
  http,
  parseEventLogs,
  type Address,
  type Hash,
} from 'viem';
import { getRpcUrl } from '../powers/contract.js';
import { powersAbi } from '../powers/abi.js';
import type { AgentSession, OrganisationConfig } from '../agent/AgentSession.js';

function getClients(session: AgentSession, org: OrganisationConfig) {
  const transport = http(getRpcUrl(org.chainId));
  const walletClient = createWalletClient({
    account: session.walletSigner,
    transport,
  });
  const publicClient = createPublicClient({ transport });
  return { walletClient, publicClient };
}

export async function propose(
  session: AgentSession,
  org: OrganisationConfig,
  mandateId: number,
  mandateCalldata: `0x${string}`,
  nonce: bigint,
  uri: string
): Promise<{ actionId: bigint; txHash: Hash }> {
  const { walletClient, publicClient } = getClients(session, org);

  // Simulate first
  await publicClient.simulateContract({
    address: org.powersAddress,
    abi: powersAbi,
    functionName: 'propose',
    args: [mandateId, mandateCalldata, nonce, uri],
    account: session.walletSigner,
  });

  const txHash = await walletClient.writeContract({
    address: org.powersAddress,
    abi: powersAbi,
    functionName: 'propose',
    args: [mandateId, mandateCalldata, nonce, uri],
    chain: null,
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: 60_000,
  });

  // Extract actionId from ProposedActionCreated log
  const logs = parseEventLogs({
    abi: powersAbi,
    eventName: 'ProposedActionCreated',
    logs: receipt.logs,
  });

  const actionId = (logs[0]?.args as any)?.actionId as bigint | undefined;
  if (actionId === undefined) {
    throw new Error('ProposedActionCreated event not found in receipt');
  }

  return { actionId, txHash };
}

export async function castVoteWithReason(
  session: AgentSession,
  org: OrganisationConfig,
  actionId: bigint,
  support: 0 | 1 | 2,
  reason: string
): Promise<{ txHash: Hash }> {
  const { walletClient, publicClient } = getClients(session, org);

  await publicClient.simulateContract({
    address: org.powersAddress,
    abi: powersAbi,
    functionName: 'castVoteWithReason',
    args: [actionId, support, reason],
    account: session.walletSigner,
  });

  const txHash = await walletClient.writeContract({
    address: org.powersAddress,
    abi: powersAbi,
    functionName: 'castVoteWithReason',
    args: [actionId, support, reason],
    chain: null,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  return { txHash };
}

export async function request(
  session: AgentSession,
  org: OrganisationConfig,
  mandateId: number,
  mandateCalldata: `0x${string}`,
  nonce: bigint,
  uri: string
): Promise<{ txHash: Hash }> {
  const { walletClient, publicClient } = getClients(session, org);

  await publicClient.simulateContract({
    address: org.powersAddress,
    abi: powersAbi,
    functionName: 'request',
    args: [mandateId, mandateCalldata, nonce, uri],
    account: session.walletSigner,
  });

  const txHash = await walletClient.writeContract({
    address: org.powersAddress,
    abi: powersAbi,
    functionName: 'request',
    args: [mandateId, mandateCalldata, nonce, uri],
    chain: null,
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 60_000 });
  return { txHash };
}
