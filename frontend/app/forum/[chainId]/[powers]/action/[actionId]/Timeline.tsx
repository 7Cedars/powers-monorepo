'use client'

import React, { useMemo } from 'react';
import { Action, Mandate } from '@/context/types';
import { useBlocks } from '@/hooks/useBlocks';
import { parseChainId } from '@/utils/parsers';
import { toFullDateFormat, toEurTimeFormat } from '@/utils/toDates';
import { fromFutureBlockToDateTime } from '@/public/organisations/helpers';
import { useBlockNumber } from 'wagmi';
import {
  CalendarDaysIcon,
  QueueListIcon,
  DocumentCheckIcon,
  CheckCircleIcon,
  RocketLaunchIcon,
  FlagIcon,
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import { usePowersStore } from '@/context/store';

export type Status = "success" | "error" | "pending";

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
  const hasVote = cond?.quorum != null && cond.quorum > 0n;
  const hasTimelock = cond?.timelock != null && cond.timelock > 0n;
  const hasThrottle = cond?.throttleExecution != null && cond.throttleExecution > 0n;
  const needsFulfilled = !!(cond?.needFulfilled && cond.needFulfilled !== 0n);
  const needsNotFulfilled = !!(cond?.needNotFulfilled && cond.needNotFulfilled !== 0n);

  // Helper to get dependent action if needed
  const getDependentAction = (dependentMandateId: bigint) => {
    if (!powers.mandates) return undefined;
    const dependentMandate = powers.mandates.find(m => m.index === dependentMandateId);
    if (!dependentMandate || !dependentMandate.actions) return undefined;
    
    // As a simple heuristic, we just look for any fulfilled action in the dependent mandate, 
    // or the latest action. Ideally we should hash the action with dependent mandate, but 
    // for timeline display we might just need to check if there's *any* fulfilled action 
    // or if the specific action ID matches. We'll find the most recent fulfilled action.
    const fulfilledActions = dependentMandate.actions.filter(a => a.fulfilledAt && a.fulfilledAt > 0n);
    if (fulfilledActions.length > 0) {
      return fulfilledActions.reduce((latest, current) => 
        (current.fulfilledAt! > latest.fulfilledAt!) ? current : latest
      );
    }
    return undefined;
  };

  // Fetch timestamps for relevant blocks so we actually have the data
  React.useEffect(() => {
    const blockNumbers: bigint[] = [];
    
    // Add blocks from the current action
    if (action.proposedAt && action.proposedAt !== 0n) blockNumbers.push(action.proposedAt);
    if (action.requestedAt && action.requestedAt !== 0n) blockNumbers.push(action.requestedAt);
    if (action.fulfilledAt && action.fulfilledAt !== 0n) blockNumbers.push(action.fulfilledAt);
    
    // Add blocks from dependent mandates
    if (mandate.conditions) {
      if (mandate.conditions.needFulfilled != null && mandate.conditions.needFulfilled !== 0n) {
        const dependentAction = getDependentAction(mandate.conditions.needFulfilled);
        if (dependentAction && dependentAction.fulfilledAt && dependentAction.fulfilledAt !== 0n) {
          blockNumbers.push(dependentAction.fulfilledAt);
        }
      }
      if (mandate.conditions.needNotFulfilled != null && mandate.conditions.needNotFulfilled !== 0n) {
        const dependentAction = getDependentAction(mandate.conditions.needNotFulfilled);
        if (dependentAction && dependentAction.fulfilledAt && dependentAction.fulfilledAt !== 0n) {
          blockNumbers.push(dependentAction.fulfilledAt);
        }
      }
    }
    
    if (blockNumbers.length > 0) {
      fetchTimestamps(blockNumbers, chainId);
    }
  }, [action, mandate.conditions, chainId, fetchTimestamps, powers.mandates]);

  // Helper function to format block number or timestamp
  const formatBlockNumberOrTimestamp = (value: bigint | undefined): string | null => {
    if (!value || value === 0n) return null;
    
    try {
      const cacheKey = `${chainId}:${value}`;
      const cachedTimestamp = timestamps.get(cacheKey);
      
      if (cachedTimestamp && cachedTimestamp.timestamp) {
        const timestampNumber = Number(cachedTimestamp.timestamp);
        const dateStr = toFullDateFormat(timestampNumber);
        const timeStr = toEurTimeFormat(timestampNumber);
        return `${dateStr}: ${timeStr}`;
      }
      
      const valueNumber = Number(value);
      if (valueNumber > 1000000000) { 
        const dateStr = toFullDateFormat(valueNumber);
        const timeStr = toEurTimeFormat(valueNumber);
        return `${dateStr}: ${timeStr}`;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  const getCheckItemDate = (itemKey: string): string | null => {
    switch (itemKey) {
      case 'needFulfilled':
      case 'needNotFulfilled': {
        const dependentMandateId = itemKey == 'needFulfilled' 
          ? mandate.conditions?.needFulfilled 
          : mandate.conditions?.needNotFulfilled;
        
        if (dependentMandateId && dependentMandateId != 0n) {
          const dependentAction = getDependentAction(dependentMandateId);
          return formatBlockNumberOrTimestamp(dependentAction?.fulfilledAt);
        }
        return null;
      }
      
      case 'proposalCreated': {
        if (action.proposedAt && action.proposedAt != 0n) {
          return formatBlockNumberOrTimestamp(action.proposedAt);
        }
        return null;
      }
      
      case 'voteEnded': {
        if (action.proposedAt && action.proposedAt != 0n && mandate.conditions?.votingPeriod && blockNumber != null) {
          const parsedChainId = parseChainId(chainId);
          if (parsedChainId == null) return null;
          
          const voteEndBlock = BigInt(action.proposedAt) + BigInt(mandate.conditions.votingPeriod);
          return fromFutureBlockToDateTime(voteEndBlock, BigInt(blockNumber), parsedChainId);
        }
        return null;
      }

      case 'delay': {
        if (action.proposedAt && action.proposedAt != 0n && mandate.conditions?.timelock && mandate.conditions.timelock != 0n && blockNumber != null) {
          const parsedChainId = parseChainId(chainId);
          if (parsedChainId == null) return null;
          
          const delayEndBlock = BigInt(action.proposedAt) + BigInt(mandate.conditions.timelock);
          return fromFutureBlockToDateTime(delayEndBlock, BigInt(blockNumber), parsedChainId);
        }
        return null;
      }
      
      case 'requested': {
        if (action.requestedAt && action.requestedAt != 0n) {
          return formatBlockNumberOrTimestamp(action.requestedAt);
        }
        return null;
      }
      
      case 'throttle':
        if (mandate.conditions?.throttleExecution && blockNumber != null) {  
          const latestFulfilledAction = mandate.actions ? Math.max(...mandate.actions.map(a => Number(a.fulfilledAt || 0)), 1) : 0;
          const parsedChainId = parseChainId(chainId);
          if (parsedChainId == null) return null;

          const throttlePassBlock = BigInt(latestFulfilledAction + Number(mandate.conditions.throttleExecution));
          return fromFutureBlockToDateTime(throttlePassBlock, BigInt(blockNumber), parsedChainId);
        }
        return null;
      
      case 'fulfilled':        
        if (action.fulfilledAt && action.fulfilledAt != 0n) {
          return formatBlockNumberOrTimestamp(action.fulfilledAt);
        }
        return null;
      
      default:
        return null;
    }
  };

  const getCheckItemStatus = (itemKey: string): Status => {
    switch (itemKey) {
      case 'needFulfilled': {
        const dependentAction = mandate.conditions?.needFulfilled ? getDependentAction(mandate.conditions.needFulfilled) : undefined;
        return dependentAction?.fulfilledAt && dependentAction.fulfilledAt > 0n ? "success" : "pending";
      }
      case 'needNotFulfilled': {
        const dependentAction = mandate.conditions?.needNotFulfilled ? getDependentAction(mandate.conditions.needNotFulfilled) : undefined;
        return dependentAction?.fulfilledAt && dependentAction.fulfilledAt > 0n ? "error" : "success";
      }
      case 'throttle': {
        const latestFulfilledAction = mandate.actions ? Math.max(...mandate.actions.map(a => Number(a.fulfilledAt || 0)), 1) : 0;
        const throttledPassed = (latestFulfilledAction + Number(mandate.conditions?.throttleExecution || 0)) < Number(blockNumber || 0);
        return throttledPassed ? "success" : "error";
      }
      case 'proposalCreated': {
        return action.proposedAt && action.proposedAt > 0n ? "success" : "pending";
      }
      case 'voteEnded': {
        return action.state && action.state == 4 ? "error" :
               action.state && action.state >= 5 ? "success" :
               "pending";
      }
      case 'delay': {
        return action.proposedAt && mandate.conditions?.timelock ? 
               action.proposedAt + mandate.conditions.timelock < BigInt(blockNumber || 0) ? "success" : "pending" : 
               "pending";
      }
      case 'requested': {
        return action.requestedAt && action.requestedAt > 0n ? "success" : "pending";
      }
      case 'fulfilled': {
        return action.fulfilledAt && action.fulfilledAt > 0n ? "success" : "pending";
      }
      default:
        return "pending";
    }
  };

  const checkItems = useMemo(() => {
    const items: { key: string; label: string; icon: React.ElementType }[] = [];

    if (needsFulfilled) {
      items.push({ key: 'needFulfilled', label: `#${cond!.needFulfilled.toString()} fulfilled`, icon: DocumentCheckIcon });
    }
    if (needsNotFulfilled) {
      items.push({ key: 'needNotFulfilled', label: `#${cond!.needNotFulfilled.toString()} not fulfilled`, icon: DocumentCheckIcon });
    }
    if (hasThrottle) {
      items.push({ key: 'throttle', label: 'Throttle passed', icon: QueueListIcon });
    }
    if (hasVote || hasTimelock) {
      items.push({ key: 'proposalCreated', label: 'Proposal created', icon: ClipboardDocumentCheckIcon });
    }
    if (hasVote) {
      items.push({ key: 'voteEnded', label: 'Vote ended', icon: FlagIcon });
    }
    if (hasTimelock) {
      items.push({ key: 'delay', label: 'Delay passed', icon: CalendarDaysIcon });
    }
    items.push({ key: 'requested', label: 'Requested', icon: CheckCircleIcon });
    items.push({ key: 'fulfilled', label: 'Fulfilled', icon: RocketLaunchIcon });

    return items;
  }, [needsFulfilled, needsNotFulfilled, hasThrottle, hasVote, hasTimelock, cond]);

  return (
    <div className="space-y-4 font-mono">
      <div className="flex items-center gap-2 mb-2">
        <QueueListIcon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Timeline</h4>
      </div>
      
      <div className="space-y-4">
        {checkItems.map((item, index) => {
          const status = getCheckItemStatus(item.key);
          const date = getCheckItemDate(item.key);
          const Icon = item.icon;
          const iconColor = status === "success" ? 'text-foreground' : status === "error" ? 'text-red-600' : 'text-muted-foreground/70';

          return (
            <div key={item.key} className="relative flex flex-col gap-1">
              {date && (
                <div className="text-[10px] text-muted-foreground/70">{date}</div>
              )}
              <div className="flex items-center gap-2">
                <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} />
                <span className={`text-xs ${iconColor}`}>{item.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
