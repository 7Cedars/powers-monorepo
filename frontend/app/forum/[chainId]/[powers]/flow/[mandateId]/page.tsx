'use client'

import { useParams } from 'next/navigation';
import { Chatroom } from "@/components/Chatroom";
import { SingleFlow } from "./SingleFlow";


export default function FlowSequencePage() {
    const { mandateId } = useParams<{ mandateId: string }>();

    return (
        <div className="flex-1 flex flex-col bg-background scanlines font-mono">
            {/* Main Content */}
            <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col border border-border overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
                    <h3 className="text-foreground uppercase tracking-wider text-base">Flow Sequence</h3>
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