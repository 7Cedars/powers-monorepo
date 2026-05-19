'use client'

import React, { useEffect, useState } from 'react';
import { Action, Mandate, Powers } from '@/context/types';
import { usePowersStore, useActionStore, useStatusStore, setError, setAction } from '@/context/store';
import { useMandate } from '@/hooks/useMandate';
import { useChecks } from '@/hooks/useChecks';
import { useBlockNumber } from 'wagmi';
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
  const { chainId } = useParams<{ chainId: string }>();
  const { data: blockNumber } = useBlockNumber();
  const { request } = useMandate();
  const { checks, fetchChecks, status: checksStatus } = useChecks();
  const { wallets } = useWallets();

  const [populatedAction, setPopulatedAction] = useState<Action | undefined>();

  useEffect(() => {
    if (propAction) {
      const found = mandate?.actions?.find(
        (a: Action) => BigInt(a.actionId) === BigInt(propAction.actionId)
      );
      setPopulatedAction(found || propAction);
    }
  }, [propAction?.actionId, mandate]);

  const parsedChainId = parseChainId(chainId);

  const timelockRemaining =
    populatedAction?.proposedAt &&
    mandate.conditions?.timelock &&
    blockNumber &&
    parsedChainId
      ? calculateTimelockRemaining(
          BigInt(populatedAction.proposedAt),
          BigInt(mandate.conditions.timelock),
          blockNumber,
          parsedChainId
        )
      : null;

  const timelockExpired = timelockRemaining === 'Ready';

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
                  timelockExpired ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                {timelockExpired
                  ? 'Ready to Execute'
                  : timelockRemaining
                  ? `${timelockRemaining} remaining`
                  : '-'}
              </span>
            </div>
          </div>

          {/* Only show execute controls once timelock has expired and action is in Succeeded state */}
          {timelockExpired && populatedAction?.state === 5 && (
            <div className="pt-2">
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
                  Execute {checks?.allPassed ? '' : '(checks did not pass)'}
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
