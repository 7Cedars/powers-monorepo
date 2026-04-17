'use client'
import React, { useMemo } from 'react';
import { Powers, Mandate } from '@/context/types';
import { bigintToRole } from "@/utils/bigintTo";
import { useRouter, useParams } from 'next/navigation';
import { SearchFilterSort } from '@/components/SearchFilterSort';

interface ActivityOverviewProps {
  powers: Powers;
}

export function ActivityOverview({ powers }: ActivityOverviewProps) {
  const router = useRouter();
  const { chainId, powers: powersAddress } = useParams<{ chainId: string; powers: string }>();

  // Extract flows and mandates
  const flowBoxes = useMemo(() => {
    const definedFlows = powers.flows || [];
    const allMandates = powers.mandates || [];
    const placedMandates = new Set<string>();

    const boxes: Array<{ flowIndex: string | undefined; nameDescription: string; mandates: Mandate[] }> = definedFlows.map(flow => {
      const mandateIdsStr = flow.mandateIds.map(id => id.toString());
      const flowMandates = allMandates.filter(m => mandateIdsStr.includes(m.index.toString()));
      
      flowMandates.forEach(m => placedMandates.add(m.index.toString()));

      return {
        flowIndex: mandateIdsStr[0],
        nameDescription: flow.nameDescription || 'Unnamed Flow:',
        mandates: flowMandates.sort((a, b) => (a.index < b.index ? -1 : 1))
      };
    }).filter(box => box.mandates.length > 0);

    // Filter orphaned mandates with quorum > 0 (as per original logic for non-flow mandates)
    const otherMandates = allMandates
      .filter(m => !placedMandates.has(m.index.toString()) && m.conditions?.quorum !== 0n && m.active)
      .sort((a, b) => (a.index < b.index ? -1 : 1));

    if (otherMandates.length > 0) {
      boxes.push({
        flowIndex: undefined,
        nameDescription: 'Other mandates:Mandates that do not belong to a governance flow.',
        mandates: otherMandates
      });
    }

    return boxes;
  }, [powers]);

  if (flowBoxes.length === 0) {
    return (
      <div className="border border-border flex flex-col h-full">
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">GOVERNANCE OVERVIEW</span>
        </div>
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No mandates found
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col border border-border min-h-0">
      <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">GOVERNANCE OVERVIEW</span>
        <SearchFilterSort 
          onSearchChange={(query) => console.log('Search:', query)}
          onFilterChange={(filter) => console.log('Filter:', filter)}
          onSortChange={(sort) => console.log('Sort:', sort)}
        />
      </div>

      {/* Was bg-muted/10 */}
      <div className="flex-1 overflow-auto p-4"> 
        <div className="flex flex-wrap gap-4">
          {flowBoxes.map((box, idx) => (
            <div key={`flow-${box.flowIndex || 'other'}-${idx}`} className="flex-1 min-w-[16rem] max-w-2xl">
              <FlowSummaryBox 
                box={box}
                powers={powers}
                chainId={chainId}
                powersAddress={powersAddress}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Sub-component for individual flows
function FlowSummaryBox({ 
  box, 
  powers, 
  chainId, 
  powersAddress 
}: {
  box: { flowIndex?: string; nameDescription: string; mandates: Mandate[] };
  powers: Powers;
  chainId: string;
  powersAddress: string;
}) {
  const router = useRouter();
  
  const [name, ...descParts] = box.nameDescription.split(':');
  const description = descParts.join(':').trim();
  const headerText = description ? `${name.trim()}: ${description}` : name.trim();
  
  // Aggregate actions
  const allActions = box.mandates.flatMap(m => m.actions || []);
  
  // Active actions: state 1 (Proposed), 3 (Active), 6 (Requested)
  const activeActionsCount = allActions.filter(a => a.state === 1 || a.state === 3 || a.state === 6).length;
  
  // Latest action
  const latestAction = allActions.sort((a, b) => {
    // sort by highest timestamp
    const timeA = Math.max(Number(a.proposedAt||0n), Number(a.requestedAt||0n), Number(a.fulfilledAt||0n));
    const timeB = Math.max(Number(b.proposedAt||0n), Number(b.requestedAt||0n), Number(b.fulfilledAt||0n));
    return timeB - timeA;
  })[0];

  return (
    <div 
      className="border border-border bg-background transition-colors relative hover:border-primary/50 cursor-pointer max-w-2xl"
      onClick={() => box.flowIndex && router.push(`/forum/${chainId}/${powersAddress}/flow/${box.flowIndex}`)}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 border-b border-border bg-muted/30 transition-colors">
        <h3 className="text-foreground tracking-wider text-sm">{name.trim() || 'Unnamed Flow'}</h3>
        {/* {box.flowIndex && (
            <span className="text-[10px] text-muted-foreground uppercase hidden sm:inline-block">View Flow →</span>
        )} */}
      </div>
      
      <div className="px-4 sm:px-6 py-4 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* Mandates list section */}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          {description && (
            <p className="text-xs text-foreground mb-4 font-mono">{description}</p>
          )}
          <div className="flex flex-col gap-2">
            {box.mandates.map(m => {
              const roleId = m.conditions?.allowedRole?.toString() || 'N/A';
              const roleName = bigintToRole(BigInt(roleId), powers);
              return (
                <div 
                  key={m.index.toString()} 
                  className={`flex items-center text-xs font-mono ${!m.active ? 'opacity-50 cursor-not-allowed' : 'group cursor-pointer'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (m.active) {
                      router.push(`/forum/${chainId}/${powersAddress}/mandate/${m.index}`);
                    }
                  }}
                >
                  <span className={`text-foreground truncate transition-colors ${!m.active ? '' : 'group-hover:text-primary group-hover:underline'}`}>
                    #{m.index.toString()} {m.nameDescription?.split(':')[0] || 'Unnamed Mandate'} - {roleName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Stats section */}
        {/* <div className="lg:flex-shrink-0 lg:w-64 border-t lg:border-t-0 lg:border-l border-border pt-4 lg:pt-0 lg:pl-8 flex flex-col justify-center">
          <div className="flex flex-col gap-2 text-xs font-mono text-foreground">
            <div>Total Actions: {allActions.length}</div>
            <div>Active Actions: {activeActionsCount}</div>
            <div className="flex items-center gap-1">
              <span className="flex-shrink-0">Last Action:</span> 
              {latestAction ? (
                <span 
                  className="truncate hover:text-primary hover:underline transition-colors group cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(`/forum/${chainId}/${powersAddress}/action/${latestAction.actionId}`);
                  }}
                >
                  {latestAction.description || 'No description'}
                </span>
              ) : (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          </div>
        </div> */}
      </div>
    </div>
  );
}
