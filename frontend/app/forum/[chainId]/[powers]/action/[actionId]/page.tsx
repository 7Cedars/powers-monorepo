'use client'
 
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePowersStore } from '@/context/store';
import { Action, Mandate } from '@/context/types';
import { ClockIcon, UserIcon, DocumentTextIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { useBlocks } from '@/hooks/useBlocks';
import { parseChainId } from '@/utils/parsers';
import { bigintToRole } from '@/utils/bigintTo';
import { Voting } from '@/components/Voting';
import { toFullDateFormat } from '@/utils/toDates';

export default function ActionPage() {
  const router = useRouter();
  const { chainId, powers: powersAddress, actionId } = useParams<{ chainId: string; powers: string; actionId: string }>();
  const powers = usePowersStore();
  const { timestamps, fetchTimestamps } = useBlocks();
  
  // Find the action across all mandates
  const [action, setAction] = useState<Action | undefined>();
  const [mandate, setMandate] = useState<Mandate | undefined>();

  useEffect(() => {
    if (powers.mandates && actionId) {
      // Search through all mandates to find the action
      for (const m of powers.mandates) {
        if (m.actions) {
          const foundAction = m.actions.find(a => a.actionId === actionId);
          if (foundAction) {
            setAction(foundAction);
            setMandate(m);
            break;
          }
        }
      }
    }
  }, [powers.mandates, actionId]);

  // Fetch timestamps for relevant blocks
  useEffect(() => {
    if (action && chainId) {
      const blockNumbers: bigint[] = [];
      if (action.proposedAt && action.proposedAt !== 0n) blockNumbers.push(action.proposedAt);
      if (action.requestedAt && action.requestedAt !== 0n) blockNumbers.push(action.requestedAt);
      if (action.fulfilledAt && action.fulfilledAt !== 0n) blockNumbers.push(action.fulfilledAt);
      if (action.cancelledAt && action.cancelledAt !== 0n) blockNumbers.push(action.cancelledAt);
      
      if (blockNumbers.length > 0) {
        fetchTimestamps(blockNumbers, chainId);
      }
    }
  }, [action, chainId, fetchTimestamps]);

  // Helper function to get state label and color
  const getStateDisplay = (state: number | undefined): { label: string; color: string } => {
    if (state === undefined) return { label: 'Unknown', color: 'text-muted-foreground' };
    
    const stateMap: Record<number, { label: string; color: string }> = {
      0: { label: 'Non Existent', color: 'text-muted-foreground' },
      1: { label: 'Proposed', color: 'text-blue-500' },
      2: { label: 'Cancelled', color: 'text-orange-500' },
      3: { label: 'Active', color: 'text-green-500' },
      4: { label: 'Defeated', color: 'text-red-500' },
      5: { label: 'Succeeded', color: 'text-green-600' },
      6: { label: 'Requested', color: 'text-yellow-500' },
      7: { label: 'Fulfilled', color: 'text-green-700' }
    };
    
    return stateMap[state] || { label: 'Unknown', color: 'text-muted-foreground' };
  };

  if (!action || !mandate) {
    return (
      <div className="min-h-screen flex flex-col bg-background scanlines font-mono">
        <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4">
          <div className="flex-1 flex flex-col border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
              <h3 className="text-foreground uppercase tracking-wider text-base">Action Not Found</h3>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[300px] gap-4">
              <p className="text-muted-foreground">The requested action could not be found.</p>
              <button
                onClick={() => router.push(`/forum/${chainId}/${powersAddress}`)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-80 transition-opacity"
              >
                Return to Forum
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const stateDisplay = getStateDisplay(action.state);
  const roleLabel = mandate.conditions?.allowedRole 
    ? bigintToRole(mandate.conditions.allowedRole, powers)
    : 'N/A';

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines font-mono">
      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
            <div className="flex-1">
              <p className="text-muted-foreground text-sm">Action #{action.actionId}</p>
              <h3 className="text-foreground text-base font-semibold">
                {action.description || 'No Description'}
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm font-medium ${stateDisplay.color}`}>
                {stateDisplay.label}
              </span>
            </div>
          </div>

          {/* Action Overview Section */}
          <div className="border-b border-border">
            <div className="p-6">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Action Overview</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <DocumentTextIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mandate</p>
                      <p 
                        className="text-sm text-foreground cursor-pointer hover:text-primary hover:underline transition-colors"
                        onClick={() => router.push(`/forum/${chainId}/${powersAddress}/mandate/${mandate.index}`)}
                      >
                        #{mandate.index.toString()} - {mandate.nameDescription?.split(':')[0] || 'Unnamed Mandate'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Role Required</p>
                      <p className="text-sm text-foreground">{roleLabel}</p>
                    </div>
                  </div>

                  {action.caller && (
                    <div className="flex items-start gap-3">
                      <UserIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Caller</p>
                        <p className="text-sm text-foreground font-mono break-all">{action.caller}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  {action.proposedAt && action.proposedAt !== 0n && (
                    <div className="flex items-start gap-3">
                      <ClockIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Proposed At</p>
                        <p className="text-sm text-foreground">
                          {timestamps.get(action.proposedAt.toString()) 
                            ? toFullDateFormat(Number(timestamps.get(action.proposedAt.toString())))
                            : `Block ${action.proposedAt.toString()}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {action.requestedAt && action.requestedAt !== 0n && (
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Requested At</p>
                        <p className="text-sm text-foreground">
                          {timestamps.get(action.requestedAt.toString()) 
                            ? toFullDateFormat(Number(timestamps.get(action.requestedAt.toString())))
                            : `Block ${action.requestedAt.toString()}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {action.fulfilledAt && action.fulfilledAt !== 0n && (
                    <div className="flex items-start gap-3">
                      <CheckCircleIcon className="h-4 w-4 text-green-700 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fulfilled At</p>
                        <p className="text-sm text-foreground">
                          {timestamps.get(action.fulfilledAt.toString()) 
                            ? toFullDateFormat(Number(timestamps.get(action.fulfilledAt.toString())))
                            : `Block ${action.fulfilledAt.toString()}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {action.cancelledAt && action.cancelledAt !== 0n && (
                    <div className="flex items-start gap-3">
                      <XCircleIcon className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cancelled At</p>
                        <p className="text-sm text-foreground">
                          {timestamps.get(action.cancelledAt.toString()) 
                            ? toFullDateFormat(Number(timestamps.get(action.cancelledAt.toString())))
                            : `Block ${action.cancelledAt.toString()}`}
                        </p>
                      </div>
                    </div>
                  )}

                  {action.nonce && (
                    <div className="flex items-start gap-3">
                      <DocumentTextIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Nonce</p>
                        <p className="text-sm text-foreground font-mono">{action.nonce}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Parameters Section */}
              {action.paramValues && action.paramValues.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Parameters</h4>
                  <div className="space-y-2">
                    {action.paramValues.map((value, idx) => (
                      <div key={idx} className="flex gap-2 text-xs">
                        <span className="text-muted-foreground font-mono">Param {idx + 1}:</span>
                        <span className="text-foreground font-mono break-all">
                          {typeof value === 'bigint' ? value.toString() : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Call Data */}
              {action.callData && action.callData !== '0x0' && (
                <div className="mt-6">
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Call Data</h4>
                  <div className="bg-muted/30 p-3 rounded border border-border">
                    <p className="text-xs text-foreground font-mono break-all">
                      {action.callData}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Voting Section - Only show if mandate has voting */}
          {mandate.conditions?.quorum && mandate.conditions.quorum > 0n && (
            <div className="border-b border-border">
              <div className="px-6 py-2 bg-muted/50">
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Voting</h4>
              </div>
              <div className="p-6">
                <Voting powers={powers} />
              </div>
            </div>
          )}

          {/* Action Chatroom Placeholder */}
          <div className="flex-1 p-6">
            <div className="flex items-center gap-2 mb-3">
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Discussion</h4>
            </div>
            <p className="text-xs text-muted-foreground/40 italic">
              Action-specific chatroom will be placed here.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
