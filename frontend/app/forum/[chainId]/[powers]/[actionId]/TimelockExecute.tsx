'use client'

import React, { useEffect, useState } from 'react';
import { Action, Mandate, Powers } from '@/context/types';
import { usePowersStore, useActionStore, useStatusStore, useErrorStore, setError, setAction } from '@/context/store';
import { parseMandateError } from '@/utils/parsers';
import { useMandate } from '@/hooks/useMandate';
import { useChecks } from '@/hooks/useChecks';
import { useScheduledDeadlinePoll } from '@/hooks/useScheduledDeadlinePoll';
import { getBlockNumber } from 'wagmi/actions';
import { wagmiConfig } from '@/context/wagmiConfig';
import { useParams } from 'next/navigation';
import { parseChainId } from '@/utils/parsers';
import { useWallets } from '@privy-io/react-auth';
import { ClockIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/Button';
import { calculateTimelockRemaining } from '@/public/organisations/helpers';

interface TimelockExecuteProps {
  action: Action;
  mandate: Mandate;
}

export const TimelockExecute: React.FC<TimelockExecuteProps> = ({ action: propAction, mandate }) => {
  const powers = usePowersStore();
  const action = useActionStore();
  const status = useStatusStore();
  const error = useErrorStore();
  const { chainId } = useParams<{ chainId: string }>();
  const { request } = useMandate();
  const { checks, fetchChecks, status: checksStatus } = useChecks();
  const { wallets } = useWallets();

  const [populatedAction, setPopulatedAction] = useState<Action | undefined>();
  const [timelockExpired, setTimelockExpired] = useState(false);
  const [estimatedRemaining, setEstimatedRemaining] = useState<string | null>(null);

  useEffect(() => {
    if (propAction) {
      const found = mandate?.actions?.find(
        (a: Action) => BigInt(a.actionId) === BigInt(propAction.actionId)
      );
      setPopulatedAction(found || propAction);
    }
  }, [propAction?.actionId, mandate]);

  const parsedChainId = parseChainId(chainId);

  const timelockEndBlock =
    populatedAction?.proposedAt && mandate.conditions?.timelock
      ? BigInt(populatedAction.proposedAt) + BigInt(mandate.conditions.timelock)
      : undefined;

  // Readiness is a pure block-number comparison (no "timelock passed" state
  // exists in getActionState()), so the check is a cheap one-off block read -
  // no contract call, no continuous block-number watching.
  useScheduledDeadlinePoll(
    timelockEndBlock,
    parsedChainId,
    async () => {
      const currentBlock = await getBlockNumber(wagmiConfig, { chainId: parsedChainId })
      if (currentBlock >= timelockEndBlock!) {
        setTimelockExpired(true)
        return true
      }
      return false
    }
  );

  // Display-only estimate, fetched once (not continuously watched) - the
  // burst-poll above is what actually decides readiness, this is just a
  // human-readable approximation shown until then.
  useEffect(() => {
    if (!populatedAction?.proposedAt || !mandate.conditions?.timelock || !parsedChainId) return
    const proposedAt = populatedAction.proposedAt
    const timelock = mandate.conditions.timelock
    getBlockNumber(wagmiConfig, { chainId: parsedChainId }).then(currentBlock => {
      setEstimatedRemaining(
        calculateTimelockRemaining(BigInt(proposedAt), BigInt(timelock), currentBlock, parsedChainId)
      )
    })
  }, [populatedAction?.proposedAt, mandate.conditions?.timelock, parsedChainId])

  // Sync checks status back to global action state (same pattern as Vote.tsx)
  useEffect(() => {
    if (checksStatus === 'success' && checks?.allPassed !== undefined) {
      setAction({ ...action, upToDate: true });
    }
  }, [checksStatus]);

  // Auto-fetch checks once timelock has expired
  useEffect(() => {
    if (
      timelockExpired &&
      powers &&
      mandate &&
      action?.callData &&
      wallets.length > 0 &&
      status.status !== 'pending'
    ) {
      fetchChecks(
        mandate,
        action.callData as `0x${string}`,
        BigInt(action.nonce || 0),
        wallets,
        powers as Powers
      );
    }
  }, [propAction?.actionId, timelockExpired, status.status]);

  const handleExecute = async () => {
    if (!mandate || !action?.callData) return;
    setError({ error: null });
    await request(
      mandate as Mandate,
      action.callData as `0x${string}`,
      BigInt(action.nonce as string),
      action.description as string,
      powers as Powers
    );
  };

  const handleRunChecks = () => {
    setError({ error: null });
    if (powers && mandate && action?.callData && wallets.length > 0) {
      fetchChecks(
        mandate,
        action.callData as `0x${string}`,
        BigInt(action.nonce || 0),
        wallets,
        powers as Powers
      );
    }
  };

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3">
        <ClockIcon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm text-foreground uppercase tracking-wider">Timelock</h4>
      </div>
      <div className="lg:overflow-y-auto lg:max-h-[300px] pr-2">
        <div className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Duration</span>
              <span className="text-foreground font-mono text-xs">
                {mandate.conditions?.timelock?.toString()} blocks
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground text-xs">Status</span>
              <span
                className={`font-mono text-xs ${
                  timelockExpired
                    ? checks && !checks.allPassed
                      ? 'text-yellow-600'
                      : 'text-green-600'
                    : 'text-yellow-600'
                }`}
              >
                {timelockExpired
                  ? (() => {
                      if (checks && !checks.allPassed) {
                        const failing = [
                          [checks.authorised,          'Not authorised'],
                          [checks.throttlePassed,      'Throttle active'],
                          [checks.actionNotFulfilled,  'Already executed'],
                          [checks.mandateFulfilled,    `Mandate #${mandate.conditions?.needFulfilled} not fulfilled`],
                          [checks.mandateNotFulfilled, `Mandate #${mandate.conditions?.needNotFulfilled} has been fulfilled`],
                          [checks.delayPassed,         'Timelock not passed'],
                          [checks.proposalPassed,      'Vote not passed'],
                        ].find(([passed]) => passed === false)
                        if (failing) return failing[1] as string
                      }
                      return 'Ready to Execute'
                    })()
                  : estimatedRemaining
                  ? `${estimatedRemaining} remaining`
                  : '-'}
              </span>
            </div>
          </div>

          {/* Only show execute controls once timelock has expired and action is in Succeeded state */}
          {timelockExpired && populatedAction?.state === 5 && (
            <div className="pt-2">
              {error.error && (
                <div className="w-full text-xs text-red-600 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 px-3 py-2 mb-2">
                  Failed check: {parseMandateError(error)}
                </div>
              )}
              {action?.upToDate ? (
                <Button
                  size={0}
                  role={6}
                  onClick={handleExecute}
                  filled={false}
                  selected={true}
                  statusButton={
                    checks?.allPassed
                      ? status.status === 'success'
                        ? 'idle'
                        : status.status
                      : 'disabled'
                  }
                >
                  Execute
                </Button>
              ) : (
                <Button
                  size={0}
                  role={6}
                  onClick={handleRunChecks}
                  filled={false}
                  selected={true}
                  statusButton="idle"
                >
                  Run checks
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
