// Type definitions for the Powers XMTP Bot

export interface Mandate {
  index: bigint;
  active: boolean;
  targetMandate: string;
  conditions: MandateConditions;
  actions?: Action[];
}

export interface MandateConditions {
  allowedRole: bigint;
  quorum: number;
  succeedAt: number;
  votingPeriod: number;
  timelock: bigint;
  throttleExecution: bigint;
  needFulfilled: bigint;
  needNotFulfilled: bigint;
}

export interface Action {
  actionId: string;
  proposedAt?: bigint;
  requestedAt?: bigint;
  fulfilledAt?: bigint;
  cancelledAt?: bigint;
  state?: number;
}

export interface GroupOperation {
  groupName: string;
  account: string;
  action: 'add' | 'remove';
}

export interface AlchemyWebhookEvent {
  webhookId: string;
  id: string;
  createdAt: string;
  type: 'ADDRESS_ACTIVITY' | 'MINED_TRANSACTION' | 'DROPPED_TRANSACTION';
  event: {
    network: string;
    activity: Array<{
      fromAddress: string;
      toAddress: string;
      blockNum: string;
      hash: string;
      value?: number;
      asset?: string;
      category: string;
      rawContract: {
        rawValue?: string;
        address?: string;
        decimals?: number;
      };
      log?: {
        address: string;
        topics: string[];
        data: string;
        blockNumber: string;
        transactionHash: string;
        transactionIndex: string;
        blockHash: string;
        logIndex: string;
        removed: boolean;
      };
    }>;
  };
}

export interface MandateAdoptedEvent {
  mandateId: bigint;
  contractAddress: string;
  chainId: string;
  blockNumber: bigint;
  transactionHash: string;
}

export interface RoleSetEvent {
  roleId: bigint;
  account: string;
  access: boolean;
  contractAddress: string;
  chainId: string;
  blockNumber: bigint;
  transactionHash: string;
}

export type ChainId = 
  | 'arbitrumSepolia'
  | 'baseSepolia'
  | 'optimismSepolia'
  | 'sepolia';