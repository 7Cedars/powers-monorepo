'use client'

import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Chatroom } from "@/components/Chatroom";
import { SingleFlow } from "./SingleFlow";
import { SelectActionDialog } from "./SelectActionDialog";
import { usePowersStore } from '@/context/store';
import { useLatestActions } from '@/hooks/useLatestActions';

export default function FlowSequencePage() {
    const { chainId, powers: powersAddress, mandateId } = useParams<{ chainId: string; powers: string; mandateId: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const [actionDialogOpen, setActionDialogOpen] = useState(false);
    
    const powers = usePowersStore();
    const allActions = useLatestActions(25);

    // Redirect to overview page if powers data is not loaded yet
    useEffect(() => {
        if (!powers || !powers.name || powers.contractAddress === '0x0' || powers.contractAddress === undefined) {
            router.push(`/forum/${chainId}/${powersAddress}`);
        }
    }, [powers, router, chainId, powersAddress]);
    
    // Get actionId from URL search params
    const actionIdFromUrl = searchParams.get('actionId');
    
    // Get mandate IDs that are part of the same flow
    const flowMandateIds = useMemo(() => {
        if (!powers || !mandateId) return new Set<bigint>();
        
        const targetFlow = powers.flows?.find(flow => flow.mandateIds.includes(BigInt(mandateId)));
        if (!targetFlow) return new Set<bigint>([BigInt(mandateId)]);
        
        return new Set(targetFlow.mandateIds);
    }, [powers, mandateId]);
    
    // Filter actions to only include those from mandates in the flow
    const filteredActions = useMemo(() => {
        if (flowMandateIds.size === 0) return allActions;
        
        return allActions.filter(action => 
            flowMandateIds.has(action.mandateId)
        );
    }, [allActions, flowMandateIds]);

    const mandate = useMemo(() => {
        if (!powers?.mandates) return undefined;
        
        if (actionIdFromUrl) {
            const action = filteredActions.find(a => a.actionId === actionIdFromUrl);
            if (action) {
                return powers.mandates.find(m => m.index === action.mandateId);
            }
        }
        
        if (!mandateId) return undefined;
        return powers.mandates.find(m => m.index.toString() === mandateId);
    }, [powers, mandateId, actionIdFromUrl, filteredActions]);

    const isPublicRole = useMemo(() => {
        if (!powers?.mandates || flowMandateIds.size === 0) return false;
        
        const flowMandates = powers.mandates.filter(m => flowMandateIds.has(BigInt(m.index.toString())));
        if (flowMandates.length === 0) return false;

        return flowMandates.every(m => {
            if (!m.conditions?.allowedRole) return false;
            return BigInt(m.conditions.allowedRole) === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        });
    }, [powers, flowMandateIds]);

    return (
        <div className="flex-1 flex flex-col bg-background scanlines font-mono">
            {/* Main Content */}
            <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col border border-border overflow-hidden">
                {/* Header */}
                <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 sm:py-2 border-b border-border bg-muted/50 gap-4 sm:gap-3">
                    { mandate ? 
                    <div className="min-w-0 flex-1 text-center sm:text-left w-full">
                        <h3 className="text-foreground text-base truncate">#{mandate?.index?.toString()} {mandate?.nameDescription ? mandate.nameDescription.split(':')[0] || '' : ''}</h3>
                        <p className="text-muted-foreground text-sm truncate">{mandate?.nameDescription ? mandate.nameDescription.split(':')[1] || '' : ''}</p>
                    </div>
                    :
                    <div className="min-w-0 flex-1 text-center sm:text-left w-full">
                        <h3 className="text-foreground uppercase tracking-wider text-base truncate">Flow Sequence</h3>
                    </div>
                    }
                    <button 
                        onClick={() => setActionDialogOpen(true)}
                        className="flex-shrink-0 flex items-center gap-2 px-6 py-2 text-sm uppercase tracking-wider whitespace-nowrap transition-opacity bg-foreground text-background hover:bg-foreground/80"
                    >
                        Select Action
                    </button>
                </div>

                {/* Flow Visualisation */}
                <div className="border-b border-border h-[320px]">
                    <SingleFlow mandateId={BigInt(mandateId)} actionId={BigInt(actionIdFromUrl ?? 0)} />
                </div>

                <Chatroom 
                    chatroomType="Flow" 
                    isPublicRole={isPublicRole}
                    chainId={chainId}
                    powersAddress={powersAddress}
                    contextId={mandateId}
                    xmtpAgentAddress={powers.metadatas?.xmtpAgentAddress}
                />

                </div>
            </main>

            {/* Select Action Dialog */}
            <SelectActionDialog
                open={actionDialogOpen}
                onOpenChange={setActionDialogOpen}
                onSelect={(actionInfo) => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('actionId', actionInfo.actionId);
                    router.push(`${pathname}?${params.toString()}`);
                }}
                actions={filteredActions}
            />
        </div>
    );

 }
