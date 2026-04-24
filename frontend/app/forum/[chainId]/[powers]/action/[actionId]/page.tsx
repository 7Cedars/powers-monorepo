'use client'
 
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePowersStore } from '@/context/store';
import { Action, Mandate } from '@/context/types';
import { useBlocks } from '@/hooks/useBlocks';
import { Chatroom } from '@/components/Chatroom';
import { ArrowLongRightIcon, DocumentTextIcon, QueueListIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { Vote } from './Vote';
import { ActionOverview } from './ActionOverview';
import { PastVotes } from './PastVotes';
import { setAction, useActionStore } from '@/context/store';
import { Timeline } from './Timeline';

export default function ActionPage() {
  const router = useRouter();
  const { chainId, powers: powersAddress, actionId } = useParams<{ chainId: string; powers: string; actionId: string }>();
  const powers = usePowersStore();
  const { timestamps, fetchTimestamps } = useBlocks();
  const action = useActionStore();

  console.log('ActionPage Action:', { actionId, action });

  // Redirect to overview page if powers data is not loaded yet
  useEffect(() => {
    if (!powers || !powers.name || powers.contractAddress === '0x0' || powers.contractAddress === undefined) {
      router.push(`/forum/${chainId}/${powersAddress}`);
    }
  }, [powers, router, chainId, powersAddress]);
  
  // Find the action across all mandates 
  const [mandate, setMandate] = useState<Mandate | undefined>();

  console.log('ActionPage:', { mandate });


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
      if (action.proposedAt && BigInt(action.proposedAt) !== 0n) blockNumbers.push(BigInt(action.proposedAt));
      if (action.requestedAt && BigInt(action.requestedAt) !== 0n) blockNumbers.push(BigInt(action.requestedAt));
      if (action.fulfilledAt && BigInt(action.fulfilledAt) !== 0n) blockNumbers.push(BigInt(action.fulfilledAt));
      if (action.cancelledAt && BigInt(action.cancelledAt) !== 0n) blockNumbers.push(BigInt(action.cancelledAt));
      
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
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 sm:py-2 border-b border-border bg-muted/50 gap-4 sm:gap-3">
            <div className="min-w-0 flex-1 text-center sm:text-left w-full">
              <h3 className="text-foreground text-base truncate">Action: #{mandate?.index?.toString()} {mandate?.nameDescription ? mandate.nameDescription.split(':')[0] || '' : ''}</h3>
              <p className="text-muted-foreground text-sm truncate">{mandate?.nameDescription ? mandate.nameDescription.split(':')[1] || '' : ''}</p>
            </div>
            <button
              onClick={() => router.push(`/forum/${chainId}/${powersAddress}/flow/${action.mandateId}?actionId=${action.actionId}`)}
              className="flex-shrink-0 flex items-center gap-2 px-6 py-2 text-sm uppercase tracking-wider whitespace-nowrap transition-opacity bg-foreground text-background hover:bg-foreground/80"
            >
              View Flow Sequence
              <ArrowLongRightIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Three Component Section - Responsive Layout */}
          <div className="border-b border-border px-6 py-6">
            <div className="flex flex-col lg:flex-row gap-6 w-full">
              {/* Action Overview Section (Left) */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-3">
                  <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm text-foreground uppercase tracking-wider">Details</h4>
                </div>
                <div className="lg:overflow-y-auto lg:max-h-[300px] pr-2">
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Description Action</h4>
                      </div>
                      <p className="text-sm text-foreground">{action.description || 'No Description'}</p>
                    </div>
                    <ActionOverview action={action} mandate={mandate} />
                  </div>
                </div>
              </div>

              {/* Separator */}
              <div className="w-full h-px lg:w-px lg:h-auto bg-border shrink-0" />

              {/* Timeline Section (Middle) */}
              <Timeline action={action} mandate={mandate} chainId={chainId} />

              {/* Voting & Past Votes Section (Right) - Only show if mandate has voting */}
              {(mandate.conditions?.quorum ? BigInt(mandate.conditions.quorum) : 0n) > 0n && (
                <>
                  {/* Separator */}
                  <div className="w-full h-px lg:w-px lg:h-auto bg-border shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
                      <h4 className="text-sm text-foreground uppercase tracking-wider">Voting</h4>
                    </div>
                    <div className="lg:overflow-y-auto lg:max-h-[300px] pr-2">
                      <div className="space-y-8">
                        <Vote action={action} mandate={mandate} />
                        <PastVotes action={action} mandate={mandate} powers={powers} />
                      </div>
                    </div>
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
            xmtpAgentAddress={powers.metadatas?.xmtpAgentAddress}
          />
         
        </div>
      </main>
    </div>
  );
}
