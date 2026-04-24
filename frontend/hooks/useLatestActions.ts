import { useMemo } from 'react';
import { usePowersStore } from '@/context/store';
import { Action } from '@/context/types';

export interface ActionWithBlockNumber extends Action {
  highestBlockNumber: bigint;
}

export const useLatestActions = (limit: number = 25): ActionWithBlockNumber[] => {
  const powers = usePowersStore();

  return useMemo(() => {
    if (!powers?.mandates) {
      return [];
    }

    // Collect all actions from all mandates
    const allActions: ActionWithBlockNumber[] = [];

    powers.mandates.forEach((mandate) => {
      if (mandate.actions) {
        mandate.actions.forEach((action) => {
          // Find the highest block number for this action
          const blockNumbers = [
            action.proposedAt || 0n,
            action.requestedAt || 0n,
            action.fulfilledAt || 0n,
            action.cancelledAt || 0n
          ].filter(bn => bn > 0n);

          const highestBlockNumber = blockNumbers.length > 0 
            ? blockNumbers.reduce((max, bn) => bn > max ? bn : max, 0n)
            : 0n;

          if (highestBlockNumber > 0n) {
            allActions.push({
              ...action,
              highestBlockNumber
            });
          }
        });
      }
    });

    // Sort by highest block number (descending)
    allActions.sort((a, b) => {
      if (a.highestBlockNumber > b.highestBlockNumber) return -1;
      if (a.highestBlockNumber < b.highestBlockNumber) return 1;
      return 0;
    });

    // Return top N actions
    return allActions.slice(0, limit);
  }, [powers?.mandates, limit]);
};