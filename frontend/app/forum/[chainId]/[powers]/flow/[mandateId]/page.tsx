'use client'

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Chatroom } from "@/components/Chatroom";
import { SingleFlow } from "./SingleFlow";
import { LatestActionsDropdown, SelectedActionInfo } from "./LatestActionsDropdown";


export default function FlowSequencePage() {
    const { mandateId } = useParams<{ mandateId: string }>();
    const [selectedAction, setSelectedAction] = useState<SelectedActionInfo | null>(null);

    const abbreviateDescription = (description: string): string => {
        return description.length > 35 
            ? `${description.slice(0, 35)}...` 
            : description;
    };

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
                            <button className="px-3 py-2 min-w-[12rem] max-w-[24rem] text-sm border border-border bg-foreground text-background hover:bg-accent transition-colors flex flex-row items-start gap-2">
                                {selectedAction ? (
                                    <>
                                        <span className="">{selectedAction.datetime} - </span>
                                        <span className="">{abbreviateDescription(selectedAction.description)}</span>
                                    </>
                                ) : (
                                    <span>No Action Selected</span>
                                )}
                            </button>
                        )}
                        align="end"
                        onSelect={(actionInfo) => setSelectedAction(actionInfo)}
                    />
                </div>

                {/* Flow Visualisation */}
                <div className="border-b border-border h-[320px]">
                    <SingleFlow mandateId={BigInt(mandateId)} />
                </div>

                <Chatroom chatroomType="Flow" />

                </div>
            </main>
        </div>
    );

 }