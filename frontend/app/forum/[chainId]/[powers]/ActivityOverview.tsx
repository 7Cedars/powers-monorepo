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
        <div className="px-4 py-2 border-b border-border bg-muted/50">
          <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">GOVERNANCE OVERVIEW</span>
        </div>
        <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">
          No mandates found
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* <div className="px-4 py-2 border-b border-border bg-muted/50 flex items-center justify-between">
        <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">GOVERNANCE OVERVIEW</span>
        <SearchFilterSort 
          onSearchChange={(query) => console.log('Search:', query)}
          onFilterChange={(filter) => console.log('Filter:', filter)}
          onSortChange={(sort) => console.log('Sort:', sort)}
        />
      </div> */}

      {/* Was bg-muted/10 */}
      <div className="flex-1 overflow-auto p-0"> 
        <div className="flex flex-wrap gap-4">
          {flowBoxes.map((box, idx) => (
            <div key={`flow-${box.flowIndex || 'other'}-${idx}`} className="flex-1 min-w-[21rem] max-w-2xl">
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

  return (
    <div 
      className="border border-border bg-background transition-colors relative hover:border-primary/50 cursor-pointer max-w-2xl"
      onClick={() => box.flowIndex && router.push(`/forum/${chainId}/${powersAddress}/flow/${box.flowIndex}`)}
    >
      <div className="flex items-center justify-between px-4 sm:px-6 py-2 bg-muted/50 transition-colors">
        <h3 className="text-foreground tracking-wider text-sm">{name.trim() || 'Unnamed Flow'}</h3>
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
                  className={`flex items-center px-3 py-2 bg-background border border-border transition-colors ${!m.active ? 'opacity-50 cursor-not-allowed text-foreground' : 'cursor-pointer hover:bg-muted/50 text-foreground hover:text-primary'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (m.active) {
                      router.push(`/forum/${chainId}/${powersAddress}/mandate/${m.index}`);
                    }
                  }}
                >
                  <span className="text-xs font-mono tracking-wider truncate">
                    #{m.index.toString()} {m.nameDescription?.split(':')[0] || 'Unnamed Mandate'} - {roleName}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
