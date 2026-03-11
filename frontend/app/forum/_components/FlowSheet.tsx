import { MessageSquare, FileText, History, Circle } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface FlowItem {
  id: number;
  name: string;
}

interface FlowSheetProps {
  flow: FlowItem | null;
  daoName: string;
  onClose: () => void;
}

export function FlowSheet({ flow, daoName, onClose }: FlowSheetProps) {
  return (
    <Sheet open={!!flow} onOpenChange={(open) => !open && onClose()}>
      <SheetContent 
        side="bottom" 
        className="h-[70vh] bg-background border-t border-border p-0 font-mono"
      >
        {flow && (
          <div className="h-full flex flex-col animate-fade-in">
            {/* Sheet Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <p className="text-xs text-muted-foreground">{daoName}</p>
                <h3 className="text-sm text-foreground mt-1">{flow.name}</h3>
              </div>
            </div>

            {/* Sheet Content - Split View */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
              {/* Left: More Details */}
              <div className="border-r border-border p-6 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Details for flow "{flow.name}" will appear here.
                </p>
                <p className="text-xs text-muted-foreground mt-2">Chatroom ID: 61837</p>
                <div className="mt-6 space-y-3 text-xs">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Status</span>
                    <span className="flex items-center gap-1.5 text-green-500">
                      <Circle className="h-2 w-2 fill-green-500 text-green-500" />
                      Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Flow Chatroom */}
              <div className="p-6 overflow-y-auto bg-muted/10">
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider">Flow Chatroom</h4>
                </div>
                <div className="flex flex-col h-[calc(100%-2rem)]">
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
                    <div className="text-center">
                      <MessageSquare className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p>Chatroom for "{flow.name}"</p>
                      <p className="mt-1 opacity-60">Coming soon...</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <input 
                      type="text" 
                      placeholder="Type a message..." 
                      className="flex-1 bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
                      disabled
                    />
                    <button 
                      className="terminal-btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Flow Sequence */}
            <div className="px-6 py-4 border-t border-border">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-3 w-3 text-muted-foreground" />
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider">FLOW SEQUENCE</h4>
              </div>
              <div className="flex items-center gap-3">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex-1 border border-border rounded px-4 py-3 flex items-center justify-center font-mono text-xs text-muted-foreground bg-muted/10">
                    MANDATE #
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation hints */}
            <div className="px-6 py-3 border-t border-border flex justify-center gap-4 text-xs text-muted-foreground">
              <span>Click another flow to switch</span>
              <span>•</span>
              <span>Press ESC or click outside to close</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
