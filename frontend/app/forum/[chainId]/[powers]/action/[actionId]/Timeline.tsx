'use client'

import React, { useMemo } from 'react';
import { Action, Mandate } from '@/context/types';
import { useBlocks } from '@/hooks/useBlocks';
import { parseChainId } from '@/utils/parsers';
import { toFullDateFormat, toEurTimeFormat } from '@/utils/toDates';
import { fromFutureBlockToDateTime } from '@/public/organisations/helpers';
import { useBlockNumber } from 'wagmi';
import { QueueListIcon } from '@heroicons/react/24/outline';
import { usePowersStore } from '@/context/store';

interface TimelineProps {
  action: Action;
  mandate: Mandate;
  chainId: string;
}

export const Timeline: React.FC<TimelineProps> = ({ action, mandate, chainId }) => {
  const { timestamps, fetchTimestamps } = useBlocks();
  const { data: blockNumber } = useBlockNumber();
  const powers = usePowersStore();

  const cond = mandate.conditions;

  // Fetch timestamps for relevant blocks
  React.useEffect(() => {
    const blockNumbers: bigint[] = [];
    
    if (action.proposedAt && BigInt(action.proposedAt) !== 0n) {
      const proposedAtBig = BigInt(action.proposedAt);
      blockNumbers.push(proposedAtBig);
      
      // Also fetch timestamp for vote end block if vote has ended
      if (cond?.votingPeriod && blockNumber) {
        const voteEndBlock = proposedAtBig + BigInt(cond.votingPeriod);
        if (voteEndBlock <= blockNumber) {
          blockNumbers.push(voteEndBlock);
        }
      }
      
      // Also fetch timestamp for delay end block if delay has passed
      if (cond?.timelock && BigInt(cond.timelock) > 0n && blockNumber) {
        const delayEndBlock = proposedAtBig + BigInt(cond.timelock);
        if (delayEndBlock <= blockNumber) {
          blockNumbers.push(delayEndBlock);
        }
      }
    }
    
    if (action.requestedAt && BigInt(action.requestedAt) !== 0n) blockNumbers.push(BigInt(action.requestedAt));
    if (action.fulfilledAt && BigInt(action.fulfilledAt) !== 0n) blockNumbers.push(BigInt(action.fulfilledAt));
    
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

    // Only show needFulfilled if it exists AND has been triggered
    if (cond?.needFulfilled != null && BigInt(cond.needFulfilled) !== 0n) {
      // Check if dependent action has been fulfilled
      const dependentMandate = powers.mandates?.find(m => BigInt(m.index) === BigInt(cond.needFulfilled));
      const hasFulfilledAction = dependentMandate?.actions?.some(a => a.fulfilledAt && BigInt(a.fulfilledAt) > 0n);
      
      if (hasFulfilledAction) {
        items.push({
          label: `#${cond.needFulfilled.toString()} Fulfilled`,
          value: '✓',
          show: true
        });
      }
    }

    // Only show needNotFulfilled if it exists AND has been checked
    if (cond?.needNotFulfilled != null && BigInt(cond.needNotFulfilled) !== 0n) {
      const dependentMandate = powers.mandates?.find(m => BigInt(m.index) === BigInt(cond.needNotFulfilled));
      const hasFulfilledAction = dependentMandate?.actions?.some(a => a.fulfilledAt && BigInt(a.fulfilledAt) > 0n);
      
      // Only show if the check has been performed (i.e., action has been proposed or later)
      if (action.proposedAt && BigInt(action.proposedAt) > 0n) {
        items.push({
          label: `#${cond.needNotFulfilled.toString()} Not Fulfilled`,
          value: hasFulfilledAction ? '✗' : '✓',
          show: true
        });
      }
    }

    // Throttle check (only show if throttle exists and action has progressed)
    if (cond?.throttleExecution != null && BigInt(cond.throttleExecution) !== 0n && action.proposedAt && BigInt(action.proposedAt) > 0n) {
      const latestFulfilledAction = mandate.actions ? Math.max(...mandate.actions.map(a => Number(a.fulfilledAt || 0)), 1) : 0;
      const throttlePassed = (latestFulfilledAction + Number(cond.throttleExecution)) < Number(blockNumber || 0);
      items.push({
        label: 'Throttle Check',
        value: throttlePassed ? '✓' : '✗',
        show: true
      });
    }

    // Proposal created
    if ((cond?.quorum != null && BigInt(cond.quorum) > 0n) || (cond?.timelock != null && BigInt(cond.timelock) > 0n)) {
      items.push({
        label: 'Proposed',
        value: formatBlockNumberOrTimestamp(action.proposedAt ? BigInt(action.proposedAt) : undefined),
        show: true
      });
    }

    // Vote ended
    if (cond?.quorum != null && BigInt(cond.quorum) > 0n && action.proposedAt && BigInt(action.proposedAt) > 0n) {
      const voteEndBlock = BigInt(action.proposedAt) + BigInt(cond.votingPeriod || 0);
      const votePassed = blockNumber && voteEndBlock <= blockNumber;
      
      items.push({
        label: 'Vote End',
        value: votePassed ? formatBlockNumberOrTimestamp(voteEndBlock) : getFutureDateTime(voteEndBlock),
        show: true
      });
    }

    // Delay passed
    if (cond?.timelock != null && BigInt(cond.timelock) > 0n && action.proposedAt && BigInt(action.proposedAt) > 0n) {
      const delayEndBlock = BigInt(action.proposedAt) + BigInt(cond.timelock || 0);
      const delayPassed = blockNumber && delayEndBlock <= blockNumber;
      
      items.push({
        label: 'Delay End',
        value: delayPassed ? formatBlockNumberOrTimestamp(delayEndBlock) : getFutureDateTime(delayEndBlock),
        show: true
      });
    }

    // Requested
    items.push({
      label: 'Requested',
      value: formatBlockNumberOrTimestamp(action.requestedAt ? BigInt(action.requestedAt) : undefined),
      show: true
    });

    // Fulfilled
    items.push({
      label: 'Fulfilled',
      value: formatBlockNumberOrTimestamp(action.fulfilledAt ? BigInt(action.fulfilledAt) : undefined),
      show: true
    });

    return items.filter(item => item.show);
  }, [action, mandate, cond, blockNumber, chainId, timestamps, powers.mandates]);

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <QueueListIcon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm text-foreground uppercase tracking-wider">Timeline</h4>
      </div>
      <div className="lg:overflow-y-auto lg:max-h-[300px] pr-2">
        {timelineItems.length > 0 ? (
          <div className="space-y-2 text-sm">
            {timelineItems.map((item, idx) => (
              <div key={idx} className="flex justify-between">
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
