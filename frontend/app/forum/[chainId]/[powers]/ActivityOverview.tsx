'use client'
import React from 'react';
import { Powers, Action } from '@/context/types';
import { bigintToRole } from "@/utils/bigintTo";
import { useRouter, useParams } from 'next/navigation';
import { useBlocks } from '@/hooks/useBlocks';
import { useBlockNumber } from 'wagmi';
import { parseChainId } from '@/utils/parsers';
import { calculateVoteTimeRemaining } from '@/public/organisations/helpers';
import { SearchFilterSort } from '@/components/SearchFilterSort';

interface ActivityOverviewProps {
  powers: Powers;
}

export function ActivityOverview({ powers }: ActivityOverviewProps) {
  const router = useRouter();
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>();
  const { data: currentBlockNumber } = useBlockNumber({ chainId: parseChainId(chainId) || undefined });
  const flows = powers.flows?.map(f => f.mandateIds) || []
  console.log({flows})
 
  // Create a map of mandate index to flow
  const mandateToFlow = new Map<string, bigint[]>();
  flows.forEach(flow => {
    flow.forEach(mandateIndex => {
      mandateToFlow.set(mandateIndex.toString(), flow);
    });
  });

  // Filter mandates: exclude orphaned mandates with quorum == 0
  const filteredMandates = (powers.mandates || []).filter(mandate => {
    const flow = mandateToFlow.get(mandate.index.toString());
    
    // If mandate is in a multi-mandate flow, include it
    if (flow && flow.length > 1) {
      return true;
    }
    
    // If mandate is orphaned (single mandate flow), only include if quorum > 0
    if (!flow || flow.length === 1) {
      return mandate.conditions?.quorum !== 0n;
    }
    
    return true;
  });

  // Group mandates by flow
  const flowGroups = new Map<string, typeof filteredMandates>();
  filteredMandates.forEach(mandate => {
    const flow = mandateToFlow.get(mandate.index.toString());
    if (flow) {
      const flowKey = flow.map(id => id.toString()).join(',');
      if (!flowGroups.has(flowKey)) {
        flowGroups.set(flowKey, []);
      }
      flowGroups.get(flowKey)!.push(mandate);
    }
  });

  // Sort mandates within each flow group by index
  flowGroups.forEach(mandates => {
    mandates.sort((a, b) => a.index < b.index ? -1 : 1);
  });
 
  if (filteredMandates.length === 0) {
    return (
      <div className="border border-border">
        <div className="px-4 py-2 border-b border-border bg-muted/50">
          <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">ACTIVITY OVERVIEW</span>
        </div>
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No mandates found
        </div>
      </div>
    );
  }

  // Helper function to get action status label with remaining time for active votes
  const getActionStatus = (action: Action, mandate: typeof filteredMandates[0]): { text: string; color: string; isActive: boolean } => {
    if (action.state === undefined) return { text: 'UNKNOWN', color: 'text-gray-500', isActive: false };
    
    // For ACTIVE state (3), calculate and display remaining time
    if (action.state === 3 && 
        action.proposedAt && 
        mandate.conditions?.votingPeriod && 
        currentBlockNumber &&
        chainId) {
      const parsedChainId = parseChainId(chainId);
      if (parsedChainId) {
        const timeRemaining = calculateVoteTimeRemaining(
          action.proposedAt,
          mandate.conditions.votingPeriod,
          currentBlockNumber,
          parsedChainId
        );
        return { text: timeRemaining, color: 'text-green-600', isActive: true };
      }
    }
    
    // Define color mapping for each state
    const stateConfig: Record<number, { text: string; color: string }> = {
      0: { text: 'NON EXISTENT', color: 'text-gray-500' },
      1: { text: 'PROPOSED', color: 'text-blue-600' },
      2: { text: 'CANCELED', color: 'text-gray-500' },
      3: { text: 'ACTIVE', color: 'text-green-600' },
      4: { text: 'DEFEATED', color: 'text-red-600' },
      5: { text: 'SUCCEEDED', color: 'text-green-600' },
      6: { text: 'REQUESTED', color: 'text-yellow-600' },
      7: { text: 'FULFILLED', color: 'text-green-700' }
    };
    
    const config = stateConfig[action.state] || { text: 'UNKNOWN', color: 'text-gray-500' };
    return { ...config, isActive: false };
  };

  // Helper function to get vote result
  const getVoteResult = (action: Action): string => {
    const forVotes = action.forVotes || 0n;
    const againstVotes = action.againstVotes || 0n;
    const abstainVotes = action.abstainVotes || 0n;
    
    // Check if voting is still ongoing
    if (action.state === 1 || (action.voteEnd && action.voteEnd > BigInt(Date.now() / 1000))) {
      return 'Voting...';
    }
    
    // Determine result based on votes
    if (forVotes > againstVotes) {
      return `FOR: ${forVotes.toString()}`;
    } else if (againstVotes > forVotes) {
      return `AGAINST: ${againstVotes.toString()}`;
    } else if (forVotes === 0n && againstVotes === 0n && abstainVotes === 0n) {
      return 'No votes';
    } else {
      return `TIE: ${forVotes.toString()}`;
    }
  };

  // Helper function to get latest 3 actions sorted by most recent
  const getLatestActions = (actions: Action[] | undefined): Action[] => {
    if (!actions || actions.length === 0) return [];
    
    // Sort by the highest of proposedAt or requestedAt (most recent first)
    const sorted = [...actions].sort((a, b) => {
      // Get the highest block number for each action
      const aTime = a.proposedAt && a.requestedAt 
        ? (a.proposedAt > a.requestedAt ? a.proposedAt : a.requestedAt)
        : (a.proposedAt || a.requestedAt || 0n);
      
      const bTime = b.proposedAt && b.requestedAt 
        ? (b.proposedAt > b.requestedAt ? b.proposedAt : b.requestedAt)
        : (b.proposedAt || b.requestedAt || 0n);
      
      if (aTime > bTime) return -1;
      if (aTime < bTime) return 1;
      return 0;
    });
    
    return sorted.slice(0, 4);
  };

  return (
    <div className="flex-1 flex flex-col border border-border min-h-0">
      <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">ACTIVITY OVERVIEW</span>
        <SearchFilterSort 
          onSearchChange={(query) => console.log('Search:', query)}
          onFilterChange={(filter) => console.log('Filter:', filter)}
          onSortChange={(sort) => console.log('Sort:', sort)}
        />
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full font-mono text-xs">
          <thead className="sticky top-0 bg-background border-b border-border z-10">
            <tr>
              <th className="w-auto md:max-w-none px-2 md:px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Mandates</th>
              <th className="hidden md:table-cell w-fit max-w-18 px-4 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Roles</th>
              <th className="w-[40px] md:w-[60px] px-1 md:px-4 py-2 text-center md:text-left text-muted-foreground uppercase text-[10px] tracking-wider">Actions</th>
              <th className="hidden md:table-cell px-2 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider max-w-48">Latest</th>
              <th className="hidden md:table-cell px-2 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(flowGroups.entries()).map(([flowKey, mandates]) => {
              const flowIndices = flowKey.split(',');

              return (
                <React.Fragment key={`flow-${flowKey}`}>
                  {/* Flow Header Row */}
                  <tr className="bg-muted/20 border-b border-border">
                    <td className="px-2 md:px-4 py-2.5 text-foreground">
                      <div className="flex items-center gap-2">
                        {mandates.length > 1 ?  
                        <span className="text-xs text-muted-foreground  cursor-pointer hover:underline"
                              onClick={() => router.push(`/forum/${chainId}/${powersAddress}/flow/${flowIndices[0]}`)}
                          >
                          Flow [mandates {flowIndices.join(', ')}]
                        </span>
                        :
                        <span className="text-xs text-muted-foreground">
                          - 
                        </span>
                        }
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-4 py-2.5 text-muted-foreground text-[10px]" >
                    </td>
                    <td className="px-1 md:px-4 py-2.5 text-muted-foreground text-[10px]" />
                    <td className="hidden md:table-cell px-4 py-2.5" />
                    <td className="hidden md:table-cell px-4 py-2.5" />
                  </tr>

                  {/* Mandate Rows */}
                  {mandates.map((mandate) => {
                    const actions = mandate.actions || [];
                    const latestActions = getLatestActions(actions);
                    const roleId = mandate.conditions?.allowedRole?.toString() || 'N/A';

                    return (
                      <tr
                        key={`mandate-${mandate.index.toString()}`}
                        className="border-b border-border hover:bg-muted/30 transition-colors align-top"
                      >
                        {/* Mandates Column */}
                        <td className="w-auto md:max-w-none px-2 md:px-4 py-3 text-foreground">
                          <div className="flex flex-col gap-1 pl-2 md:pl-4">
                            <div>
                              <span className="text-muted-foreground mr-1.5">#{mandate.index.toString()}</span>
                              <span 
                                className="font-semibold cursor-pointer text-sm hover:text-primary hover:underline transition-colors"
                                onClick={() => router.push(`/forum/${chainId}/${powersAddress}/mandate/${mandate.index}`)}
                              >
                                {`${mandate.nameDescription?.split(':')[0]}`}
                              </span>
                            </div>
                            
                            {/* Description - hidden on small screens */}
                            {mandate.nameDescription && (
                              <div className="hidden md:block text-muted-foreground leading-relaxed max-w-md">
                                {mandate?.nameDescription ? mandate.nameDescription.split(':')[1] || '' : ''}
                              </div>
                            )}
                            
                            {/* Roles - shown on small screens only */}
                            <div className="md:hidden text-xs text-muted-foreground mt-1">
                              <span className="font-semibold">Role: </span>
                              {bigintToRole(BigInt(roleId), powers)}
                            </div>
                            
                            {/* Latest Actions - shown on small screens only */}
                            {latestActions.length > 0 && (
                              <div className="md:hidden mt-2 flex flex-col gap-1">
                                <span className="text-[10px] uppercase text-muted-foreground">Latest actions:</span>
                                {latestActions.map((action, idx) => {
                                  const status = getActionStatus(action, mandate);
                                  return (
                                    <div key={`mobile-action-${action.actionId}-${idx}`} className="flex items-start gap-2">
                                      <span
                                        className="text-foreground text-xs cursor-pointer hover:text-primary hover:underline transition-colors flex-1 truncate"
                                        onClick={() => router.push(`/forum/${chainId}/${powersAddress}/action/${action.actionId}`)}
                                      >
                                        {action.description || 'No description'}
                                      </span>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        {status.isActive && (
                                          <span className="w-2 h-2 bg-green-500" />
                                        )}
                                        <span className={`${status.color} text-[10px]`}>
                                          {status.text}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Roles Column - hidden on small screens */}
                        <td className="hidden md:table-cell px-4 py-3 text-muted-foreground">
                          {bigintToRole(BigInt(roleId), powers)}
                        </td>

                        {/* Actions Column */}
                        <td className="px-1 md:px-4 py-3 text-muted-foreground text-center md:text-left">
                          {actions.length}
                        </td>

                        {/* Latest Column - hidden on small screens */}
                        <td className="hidden md:table-cell px-4 py-3 max-w-48">
                          {latestActions.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {latestActions.map((action, idx) => (
                                <span
                                  key={`action-${action.actionId}-${idx}`}
                                  className="text-foreground text-xs cursor-pointer hover:text-primary hover:underline transition-colors block truncate"
                                  onClick={() => router.push(`/forum/${chainId}/${powersAddress}/action/${action.actionId}`)}
                                >
                                  {action.description || 'No description'}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-[10px]">No actions yet</span>
                          )}
                        </td>

                        {/* Status Column - hidden on small screens */}
                        <td className="hidden md:table-cell px-4 py-3">
                          {latestActions.length > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              {latestActions.map((action, idx) => {
                                const status = getActionStatus(action, mandate);
                                return (
                                  <div
                                    key={`status-${action.actionId}-${idx}`}
                                    className="flex items-center gap-1.5"
                                  >
                                    {status.isActive && (
                                      <span className="w-2 h-2  bg-green-500 flex-shrink-0" />
                                    )}
                                    <span className={`${status.color} text-xs`}>
                                      {status.text}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-muted-foreground/50 text-[10px]">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
