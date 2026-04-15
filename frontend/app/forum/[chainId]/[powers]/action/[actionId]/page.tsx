'use client'
 
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePowersStore } from '@/context/store';
import { Action, Mandate } from '@/context/types';
import { useBlocks } from '@/hooks/useBlocks';
import { Chatroom } from '@/components/Chatroom';
import { ArrowLongRightIcon } from '@heroicons/react/24/outline';
import { Vote } from './Vote';
import { ActionOverview } from './ActionOverview';
import { PastVotes } from './PastVotes';
import { setAction, useActionStore } from '@/context/store';

export default function ActionPage() {
  const router = useRouter();
  const { chainId, powers: powersAddress, actionId } = useParams<{ chainId: string; powers: string; actionId: string }>();
  const powers = usePowersStore();
  const { timestamps, fetchTimestamps } = useBlocks();
  const action = useActionStore();
  
  // Find the action across all mandates 
  const [mandate, setMandate] = useState<Mandate | undefined>();

  useEffect(() => {
    if (powers.mandates && actionId) {
      // Search through all mandates to find the action
      for (const m of powers.mandates) {
        if (m.actions) {
          const foundAction = m.actions.find(a => a.actionId === actionId);
          // console.log(`Searching for actionId ${actionId} in mandate ${m.index}:`, foundAction);
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
      <div className="flex-1 flex flex-col bg-background scanlines font-mono">
        <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4">
          <div className="flex-1 flex flex-col border border-border overflow-hidden">
            <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
              <h3 className="text-foreground uppercase tracking-wider text-base">Action Not Found</h3>
            </div>
            <div className="p-6 flex flex-col items-center justify-center min-h-[300px] gap-4">
              <p className="text-muted-foreground">The requested action could not be found.</p>
              <button
                onClick={() => router.push(`/forum/${chainId}/${powersAddress}`)}
                className="px-4 py-2 bg-primary text-primary-foreground  hover:opacity-80 transition-opacity"
              >
                Return to Forum
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background scanlines font-mono">
      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-2 border-b border-border bg-muted/50 gap-3">
            <div className="flex-1">
              <h3 className="text-foreground text-base">
                {action.description || 'No Description'}
              </h3>
              <p className="text-muted-foreground text-sm">Mandate #{action.mandateId}: {mandate.nameDescription?.split(':')[0] || 'Unnamed Mandate'}</p>
            </div>
            <div className="flex items-center gap-3">
                <button
                onClick={() => router.push(`/forum/${chainId}/${powersAddress}/flow/${action.mandateId}?actionId=${action.actionId}`)}
                className="terminal-btn-sm flex items-center gap-2 text-sm px-4 py-2 bg-foreground text-background hover:bg-foreground/80 hover:text-background whitespace-nowrap">
                VIEW FLOW SEQUENCE
                  <ArrowLongRightIcon className="h-3 w-3" />
                </button>
            </div>
          </div>

          {/* Three Component Section - Responsive Layout */}
          <div className="border-b border-border">
            <div className="flex flex-col lg:flex-row lg:divide-x divide-border w-full">
              {/* Action Overview Section */}
              <div className="flex-1 min-w-0 border-b lg:border-b-0 border-border p-6">
                <ActionOverview action={action} mandate={mandate} />
              </div>

              {/* Voting Section - Only show if mandate has voting */}
              {mandate.conditions?.quorum && mandate.conditions.quorum > 0n && (
                <>
                  <div className="flex-1 min-w-0 border-b lg:border-b-0 border-border p-6">
                    <Vote action={action} mandate={mandate} />
                  </div>

                  {/* Past Votes Section */}
                  <div className="flex-1 min-w-0 p-6">
                    <PastVotes action={action} mandate={mandate} powers={powers} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Action Chatroom Placeholder */}
          <Chatroom 
            chatroomType="Action"
            isPublicRole={mandate.conditions?.allowedRole ? BigInt(mandate.conditions.allowedRole) === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') : false}
            chainId={chainId}
            powersAddress={powersAddress}
            contextId={actionId}
          />
         
        </div>
      </main>
    </div>
  );
}
