'use client'

import React, { useMemo } from 'react';
import { Action, Mandate } from '@/context/types';
import { useBlocks, L2_TO_L1_CHAIN_MAP } from '@/hooks/useBlocks';
import { parseChainId } from '@/utils/parsers';
import { toFullDateFormat, toEurTimeFormat } from '@/utils/toDates';
import { fromFutureBlockToDateTime } from '@/public/organisations/helpers';
import { useBlockNumber } from 'wagmi';
import { usePowersStore } from '@/context/store';
import { hashAction } from '@/utils/hashAction';

interface TimelineProps {
  action: Action;
  mandate: Mandate;
  chainId: string;
}

export const Timeline: React.FC<TimelineProps> = ({ action, mandate, chainId }) => {
  const { timestamps, fetchTimestamps } = useBlocks();
  const parsedChainId = parseChainId(chainId) as number;
  const blockChainId = (L2_TO_L1_CHAIN_MAP[parsedChainId] ?? parsedChainId) as number;
  const { data: blockNumber } = useBlockNumber({ chainId: blockChainId });
  const powers = usePowersStore();

  const cond = mandate.conditions;

  // Always-available blocks - fetch once, independent of blockNumber resolving.
  React.useEffect(() => {
    const blockNumbers: bigint[] = [];
    if (action.proposedAt && BigInt(action.proposedAt) !== 0n) blockNumbers.push(BigInt(action.proposedAt));
    if (action.requestedAt && BigInt(action.requestedAt) !== 0n) blockNumbers.push(BigInt(action.requestedAt));
    if (action.fulfilledAt && BigInt(action.fulfilledAt) !== 0n) blockNumbers.push(BigInt(action.fulfilledAt));
    if (blockNumbers.length > 0) {
      fetchTimestamps(blockNumbers, chainId);
    }
  }, [action, chainId, fetchTimestamps]);

  // Vote End / Delay End - only fetchable once blockNumber resolves; kept in its
  // own effect so it doesn't re-trigger a redundant re-fetch of the blocks above
  // every time blockNumber changes.
  React.useEffect(() => {
    if (!action.proposedAt || BigInt(action.proposedAt) === 0n || !blockNumber) return;
    const proposedAtBig = BigInt(action.proposedAt);
    const blockNumbers: bigint[] = [];

    if (cond?.votingPeriod) {
      const voteEndBlock = proposedAtBig + BigInt(cond.votingPeriod);
      if (voteEndBlock <= blockNumber) {
        blockNumbers.push(voteEndBlock);
      }
    }

    if (cond?.timelock && BigInt(cond.timelock) > 0n) {
      const delayEndBlock = proposedAtBig + BigInt(cond.timelock);
      if (delayEndBlock <= blockNumber) {
        blockNumbers.push(delayEndBlock);
      }
    }

    if (blockNumbers.length > 0) {
      fetchTimestamps(blockNumbers, chainId);
    }
  }, [action, chainId, fetchTimestamps, cond, blockNumber]);

  // Helper function to format block number or timestamp
  const formatBlockNumberOrTimestamp = (value: bigint | undefined): string => {
    if (!value || value === 0n) return '-';
    
    try {
      const cacheKey = `${chainId}:${value}`;
      const cachedTimestamp = timestamps.get(cacheKey);
      
      if (cachedTimestamp && cachedTimestamp.timestamp) {
        const timestampNumber = Number(cachedTimestamp.timestamp);
        const dateStr = toFullDateFormat(timestampNumber);
        const timeStr = toEurTimeFormat(timestampNumber);
        return `${dateStr} ${timeStr}`;
      }
      
      return '-';
    } catch (error) {
      return '-';
    }
  };

  // Helper to get formatted date for future events
  const getFutureDateTime = (targetBlock: bigint): string => {
    if (!blockNumber) return '-';
    const parsedChainId = parseChainId(chainId);
    if (!parsedChainId) return '-';
    return fromFutureBlockToDateTime(targetBlock, BigInt(blockNumber), parsedChainId) || '-';
  };

  // Build timeline items
  const timelineItems = useMemo(() => {
    const items: Array<{ label: string; value: string; show: boolean }> = [];

    // 1. needFulfilled — always show when condition is set
    if (cond?.needFulfilled != null && BigInt(cond.needFulfilled) !== 0n) {
      const dependentMandate = powers.mandates?.find(m => BigInt(m.index) === BigInt(cond.needFulfilled));
      let hasFulfilledAction = false;
      if (action.callData && action.nonce) {
        const dependentActionId = hashAction(
          BigInt(cond.needFulfilled),
          action.callData,
          BigInt(action.nonce)
        ).toString();
        const dependentAction = dependentMandate?.actions?.find(a => a.actionId === dependentActionId);
        hasFulfilledAction = !!dependentAction?.fulfilledAt && BigInt(dependentAction.fulfilledAt) > 0n;
      }
      items.push({
        label: `#${cond.needFulfilled.toString()} Fulfilled`,
        value: hasFulfilledAction ? '✓' : '✗',
        show: true
      });
    }

    // 2. needNotFulfilled — always show when condition is set
    if (cond?.needNotFulfilled != null && BigInt(cond.needNotFulfilled) !== 0n) {
      const dependentMandate = powers.mandates?.find(m => BigInt(m.index) === BigInt(cond.needNotFulfilled));
      let hasFulfilledAction = false;
      if (action.callData && action.nonce) {
        const dependentActionId = hashAction(
          BigInt(cond.needNotFulfilled),
          action.callData,
          BigInt(action.nonce)
        ).toString();
        const dependentAction = dependentMandate?.actions?.find(a => a.actionId === dependentActionId);
        hasFulfilledAction = !!dependentAction?.fulfilledAt && BigInt(dependentAction.fulfilledAt) > 0n;
      }
      items.push({
        label: `#${cond.needNotFulfilled.toString()} Not Fulfilled`,
        value: hasFulfilledAction ? '✗' : '✓',
        show: true
      });
    }

    // 3. Throttle check — always show when condition is set
    if (cond?.throttleExecution != null && BigInt(cond.throttleExecution) !== 0n) {
      const latestFulfilledAction = mandate.actions ? Math.max(...mandate.actions.map(a => Number(a.fulfilledAt || 0)), 1) : 0;
      const throttlePassed = (latestFulfilledAction + Number(cond.throttleExecution)) < Number(blockNumber || 0);
      items.push({
        label: 'Throttle Check',
        value: throttlePassed ? '✓' : '✗',
        show: true
      });
    }

    // 4. Proposed — show when mandate requires a vote or timelock
    if ((cond?.quorum != null && BigInt(cond.quorum) > 0n) || (cond?.timelock != null && BigInt(cond.timelock) > 0n)) {
      items.push({
        label: 'Proposed',
        value: formatBlockNumberOrTimestamp(action.proposedAt ? BigInt(action.proposedAt) : undefined),
        show: true
      });
    }

    // 5. Vote End — always show when quorum is set, placeholder until proposed
    if (cond?.quorum != null && BigInt(cond.quorum) > 0n) {
      if (action.proposedAt && BigInt(action.proposedAt) > 0n) {
        const voteEndBlock = BigInt(action.proposedAt) + BigInt(cond.votingPeriod || 0);
        const votePassed = blockNumber && voteEndBlock <= blockNumber;
        items.push({
          label: 'Vote End',
          value: votePassed ? formatBlockNumberOrTimestamp(voteEndBlock) : getFutureDateTime(voteEndBlock),
          show: true
        });
      } else {
        items.push({ label: 'Vote End', value: '-', show: true });
      }
    }

    // 6. Delay End — always show when timelock is set, placeholder until proposed
    if (cond?.timelock != null && BigInt(cond.timelock) > 0n) {
      if (action.proposedAt && BigInt(action.proposedAt) > 0n) {
        const delayEndBlock = BigInt(action.proposedAt) + BigInt(cond.timelock || 0);
        const delayPassed = blockNumber && delayEndBlock <= blockNumber;
        items.push({
          label: 'Delay End',
          value: delayPassed ? formatBlockNumberOrTimestamp(delayEndBlock) : getFutureDateTime(delayEndBlock),
          show: true
        });
      } else {
        items.push({ label: 'Delay End', value: '-', show: true });
      }
    }

    // 7. Requested
    items.push({
      label: 'Requested',
      value: formatBlockNumberOrTimestamp(action.requestedAt ? BigInt(action.requestedAt) : undefined),
      show: true
    });

    // 8. Fulfilled
    items.push({
      label: 'Fulfilled',
      value: formatBlockNumberOrTimestamp(action.fulfilledAt ? BigInt(action.fulfilledAt) : undefined),
      show: true
    });

    return items.filter(item => item.show);
  }, [action, mandate, cond, blockNumber, chainId, timestamps, powers.mandates]);

  return (
    <div className="flex-1 min-w-0">
      <div className="lg:overflow-y-auto lg:max-h-[300px] pr-2">
        {timelineItems.length > 0 ? (
          <div className="flex flex-col gap-y-1.5 text-xs">
            {timelineItems.map((item, idx) => (
              <div key={idx} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground/50 text-xs">No timeline data available</p>
        )}
      </div>
    </div>
  );
}
