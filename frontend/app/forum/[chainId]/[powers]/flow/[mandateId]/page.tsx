'use client'

import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Chatroom } from "@/components/Chatroom";
import { SingleFlow } from "./SingleFlow";
import { LatestActionsDropdown, SelectedActionInfo } from "./LatestActionsDropdown";
import { usePowersStore } from '@/context/store';
import { identifyFlows } from '@/utils/identifyFlows';
import { useLatestActions } from '@/hooks/useLatestActions';
import { useBlocks } from '@/hooks/useBlocks';
import { toFullDateAndTimeFormat } from '@/utils/toDates';


export default function FlowSequencePage() {
    const { chainId, powers: powersAddress, mandateId } = useParams<{ chainId: string; powers: string; mandateId: string }>();
    const searchParams = useSearchParams();
    const [selectedAction, setSelectedAction] = useState<SelectedActionInfo | null>(null);
    
    const powers = usePowersStore();
    const allActions = useLatestActions(25);
    const { timestamps, fetchTimestamps } = useBlocks();
    
    // Get actionId from URL search params
    const actionIdFromUrl = searchParams.get('actionId');
    
    // Get mandate IDs that are part of the same flow
    const flowMandateIds = useMemo(() => {
        if (!powers || !mandateId) return new Set<bigint>();
        
        const flows = identifyFlows(powers, BigInt(mandateId));
        if (flows.length === 0) return new Set<bigint>();
        
        // identifyFlows returns [[mandateIds]] when given a specific mandateId
        return new Set(flows[0]);
    }, [powers, mandateId]);
    
    // Filter actions to only include those from mandates in the flow
    const filteredActions = useMemo(() => {
        if (flowMandateIds.size === 0) return allActions;
        
        return allActions.filter(action => 
            flowMandateIds.has(action.mandateId)
        );
    }, [allActions, flowMandateIds]);

    // Auto-select action from URL search params
    useEffect(() => {
        if (actionIdFromUrl && filteredActions.length > 0 && chainId) {
            const matchingAction = filteredActions.find(
                action => action.actionId === actionIdFromUrl
            );
            if (matchingAction) {
                // Fetch timestamp for this action
                fetchTimestamps([matchingAction.highestBlockNumber], chainId);
                
                // Create SelectedActionInfo with datetime
                const key = `${chainId}:${matchingAction.highestBlockNumber}`;
                const blockTimestamp = timestamps.get(key);
                
                const actionInfo: SelectedActionInfo = {
                    actionId: matchingAction.actionId,
                    datetime: blockTimestamp?.timestamp 
                        ? toFullDateAndTimeFormat(Number(blockTimestamp.timestamp))
                        : `Block ${matchingAction.highestBlockNumber}`,
                    description: matchingAction.description || "No description"
                };
                
                setSelectedAction(actionInfo);
            }
        }
    }, [actionIdFromUrl, filteredActions, chainId, timestamps, fetchTimestamps]);

    const abbreviateDescription = (description: string): string => {
        return description.length > 35 
            ? `${description.slice(0, 8)}...${description.slice(-8)}` 
            : description;
    };

    const isPublicRole = useMemo(() => {
        if (!powers?.mandates || !mandateId) return false;
        const mandate = powers.mandates.find(m => m.index.toString() === mandateId);
        if (!mandate?.conditions?.allowedRole) return false;
        return BigInt(mandate.conditions.allowedRole) === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    }, [powers, mandateId]);

    return (
        <div className="flex-1 flex flex-col bg-background scanlines font-mono">
            {/* Main Content */}
            <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col border border-border overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
                    <h3 className="text-foreground uppercase tracking-wider text-base">Flow Sequence</h3>
                    <LatestActionsDropdown 
                        trigger={() => (
                            <button className="px-3 py-2 min-w-[12rem] max-w-[24rem] text-xs text-center border border-border bg-foreground text-background hover:bg-accent transition-colors flex flex-row items-center gap-2">
                                {selectedAction ? (
                                    <>
                                        <span className="">{selectedAction.datetime} - </span>
                                        <span className="">{abbreviateDescription(selectedAction.description)}</span>
                                    </>
                                ) : (
                                    <span>Select Action</span>
                                )}
                            </button>
                        )}
                        align="end"
                        onSelect={(actionInfo) => setSelectedAction(actionInfo)}
                        actions={filteredActions}
                    />
                </div>

                {/* Flow Visualisation */}
                <div className="border-b border-border h-[320px]">
                    <SingleFlow mandateId={BigInt(mandateId)} actionId={BigInt(selectedAction?.actionId ?? 0)} />
                </div>

                <Chatroom 
                    chatroomType="Flow" 
                    isPublicRole={isPublicRole}
                    chainId={chainId}
                    powersAddress={powersAddress}
                    contextId={mandateId}
                />

                </div>
            </main>
        </div>
    );

 }