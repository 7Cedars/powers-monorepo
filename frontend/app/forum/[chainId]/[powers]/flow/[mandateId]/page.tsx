'use client'

import { Chatroom } from "@/components/Chatroom";

 
export default function FlowSequencePage() { 
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
                <div className="border-b border-border p-6 flex flex-col items-center justify-center min-h-[150px] gap-4">
                    {/* <img src={flowVisualisationImg} alt="Flow visualisation diagram" className="max-w-full max-h-[400px] object-contain" /> */}
                    <p className="text-xs text-muted-foreground/40 italic">TODO: Flow visualisation will be placed here.</p>
                </div>

                {/* More Details */}
                <div className="border-b border-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
                    </div>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed">Here you will see more details about what this flow does, and what mandates it is comprised of.</p>
                    
                    <p className="text-xs text-muted-foreground mt-1">Flow ID: 48291</p>
                </div>
                
                <Chatroom chatroomType="Flow" />
                
                </div>
            </main>    
        </div>
    );

 }