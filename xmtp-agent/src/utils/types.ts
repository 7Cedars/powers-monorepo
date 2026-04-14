import type { Address } from 'viem';

export interface Mandate {
  index: bigint;
  targetMandate: Address;
  active: boolean;
  conditions: {
    allowedRole: bigint;
    votingPeriod: number;
    timelock: bigint;
    throttleExecution: bigint;
    needFulfilled: bigint;
    needNotFulfilled: bigint;
    quorum: number;
    succeedAt: number;
  };
}

export interface GroupOperation {
  groupName: string;
  account: string;
  action: 'add' | 'remove';
}

export interface PowersRoleSetEvent {
  roleId: bigint;
  account: Address;
  access: boolean;
  powersAddress: Address;
  chainId: number;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}