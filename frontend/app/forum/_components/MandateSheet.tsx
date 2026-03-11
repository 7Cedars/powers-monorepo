import { useState, useCallback, useMemo, useEffect } from 'react';
import { MessageSquare, FileText, History, Circle, Vote, Lock } from 'lucide-react';
import { ChatroomPlaceholder } from '@/components/ChatroomPlaceholder';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { DaoMandate } from '@/data/daoConfig';
import { ChatMessage, ChatMessageData } from '@/components/ChatMessage';
import { getMandateChatMessages } from '@/data/mandateChatMessages';
import { ChatFilter, ChatFilterState } from '@/components/ChatFilter';
import { applyFilter, extractHashtags, extractRoles } from '@/lib/chatFilterUtils';

interface VoteResults {
  total: number;
  yes: number;
  no: number;
  abstain: number;
}

interface MandateSheetProps {
  mandate: DaoMandate | null;
  daoName: string;
  isWalletConnected: boolean;
  allMandates?: DaoMandate[];
  onClose: () => void;
  onSwitchMandate?: (mandate: DaoMandate) => void;
}

export function MandateSheet({ mandate, daoName, isWalletConnected, allMandates = [], onClose, onSwitchMandate }: MandateSheetProps) {
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [votedMandates, setVotedMandates] = useState<Record<string, VoteResults>>({});
  const [viewingFlowChat, setViewingFlowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>(() => 
    mandate ? getMandateChatMessages(mandate.id) : []
  );
  const [flowChatMessages, setFlowChatMessages] = useState<ChatMessageData[]>(() =>
    mandate ? getMandateChatMessages(mandate.flowId) : []
  );
  const [mandateChatFilter, setMandateChatFilter] = useState<ChatFilterState>({ type: 'none' });

  // Reset chat messages when mandate changes
  useEffect(() => {
    if (mandate) {
      setChatMessages(getMandateChatMessages(mandate.id));
      setFlowChatMessages(getMandateChatMessages(mandate.flowId));
      setMandateChatFilter({ type: 'none' });
      setViewingFlowChat(false);
    }
  }, [mandate?.id]);
  const activeMessages = viewingFlowChat ? flowChatMessages : chatMessages;
  const filteredMandateMessages = useMemo(() => applyFilter(activeMessages, mandateChatFilter), [activeMessages, mandateChatFilter]);
  const mandateHashtags = useMemo(() => extractHashtags(activeMessages), [activeMessages]);
  const mandateRoles = useMemo(() => extractRoles(activeMessages), [activeMessages]);

  const handleMandateHashtagClick = useCallback((hashtag: string) => {
    setMandateChatFilter({ type: 'hashtag', hashtag });
  }, []);
  const chatScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // Use ResizeObserver to detect when the element is properly sized
      const observer = new ResizeObserver(() => {
        node.scrollTop = node.scrollHeight;
      });
      observer.observe(node);
      // Clean up after a short delay once scrolled
      setTimeout(() => observer.disconnect(), 1000);
    }
  }, [mandate]);

  const handleUpvote = useCallback((id: string) => {
    const updateVotes = (msgs: ChatMessageData[]): ChatMessageData[] =>
      msgs.map(m => {
        if (m.id === id) {
          const wasUp = m.userVote === 'up';
          return { ...m, upvotes: wasUp ? m.upvotes - 1 : m.upvotes + 1, downvotes: m.userVote === 'down' ? m.downvotes - 1 : m.downvotes, userVote: wasUp ? null : 'up' as const };
        }
        return m.replies ? { ...m, replies: updateVotes(m.replies) } : m;
      });
    setChatMessages(updateVotes);
  }, []);

  const handleDownvote = useCallback((id: string) => {
    const updateVotes = (msgs: ChatMessageData[]): ChatMessageData[] =>
      msgs.map(m => {
        if (m.id === id) {
          const wasDown = m.userVote === 'down';
          return { ...m, downvotes: wasDown ? m.downvotes - 1 : m.downvotes + 1, upvotes: m.userVote === 'up' ? m.upvotes - 1 : m.upvotes, userVote: wasDown ? null : 'down' as const };
        }
        return m.replies ? { ...m, replies: updateVotes(m.replies) } : m;
      });
    setChatMessages(updateVotes);
  }, []);

  const handleReply = useCallback((parentId: string, replyText: string) => {
    const addReply = (msgs: ChatMessageData[]): ChatMessageData[] =>
      msgs.map(m => {
        if (m.id === parentId) {
          const newReply: ChatMessageData = {
            id: `${parentId}-r${Date.now()}`,
            sender: 'anon',
            address: '',
            message: replyText,
            timestamp: new Date(),
            upvotes: 0,
            downvotes: 0,
          };
          return { ...m, replies: [...(m.replies || []), newReply] };
        }
        return m.replies ? { ...m, replies: addReply(m.replies) } : m;
      });
    setChatMessages(addReply);
  }, []);
  const generateResults = (userVote: string): VoteResults => {
    const total = Math.floor(Math.random() * 40) + 40;
    const remaining = total;
    const yes = Math.floor(Math.random() * remaining * 0.6) + Math.floor(remaining * 0.1);
    const no = Math.floor(Math.random() * (remaining - yes) * 0.7) + Math.floor((remaining - yes) * 0.1);
    const abstain = remaining - yes - no;
    const results = { total: total + 1, yes, no, abstain };
    if (userVote === 'yes') results.yes += 1;
    else if (userVote === 'no') results.no += 1;
    else results.abstain += 1;
    return results;
  };

  const confirmVote = () => {
    if (pendingVote && mandate) {
      setVotedMandates(prev => ({
        ...prev,
        [mandate.id]: generateResults(pendingVote),
      }));
      setPendingVote(null);
    }
  };

  const currentResults = mandate ? votedMandates[mandate.id] : undefined;

  return (
    <>
      <Sheet open={!!mandate} onOpenChange={(open) => !open && onClose()}>
        <SheetContent 
          side="bottom" 
          className="h-[85vh] bg-background border-t border-border p-0 font-mono"
        >
          {mandate && (
            <div className="h-full flex flex-col animate-fade-in">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-2 border-b border-border">
                <div>
                  <p className="text-[10px] text-muted-foreground">{daoName}</p>
                  <h3 className="text-xs text-foreground">[CUSTOM MANDATE NAME]</h3>
                </div>
              </div>

              {/* Flow Sequence - right below title */}
              <div className="px-6 py-2 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <History className="h-3 w-3 text-muted-foreground" />
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider">FLOW SEQUENCE</h4>
                </div>
                <div className="flex items-center gap-3">
                  {(() => {
                    const flowMandates = allMandates.filter(m => m.flowId === mandate.flowId);
                    const mandateBoxes = (flowMandates.length === 0 ? [mandate] : flowMandates).map((m) => {
                      const isCurrent = m.id === mandate.id && !viewingFlowChat;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            if (viewingFlowChat) {
                              setViewingFlowChat(false);
                              if (m.id !== mandate.id) onSwitchMandate?.(m);
                            } else if (!isCurrent) {
                              onSwitchMandate?.(m);
                            }
                          }}
                          className={`flex-1 border rounded px-4 py-1.5 flex items-center justify-center font-mono text-xs transition-colors ${isCurrent ? 'border-border text-muted-foreground/50 bg-muted/5 cursor-default' : 'border-border text-foreground bg-muted/10 hover:bg-muted/30 hover:border-foreground/40 cursor-pointer'}`}
                        >
                          [MANDATE {flowMandates.indexOf(m) + 1}]
                        </div>
                      );
                    });
                    return (
                      <>
                        {mandateBoxes}
                        <div
                          onClick={() => setViewingFlowChat(true)}
                          className={`flex-1 border rounded px-4 py-1.5 flex items-center justify-center font-mono text-xs transition-colors ${viewingFlowChat ? 'border-border text-muted-foreground/50 bg-muted/5 cursor-default' : 'border-border text-foreground bg-muted/10 hover:bg-muted/30 hover:border-foreground/40 cursor-pointer'}`}
                        >
                          Flow Chatroom
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Chatroom - full width, takes up majority of space */}
              <div className="flex-1 min-h-0 flex flex-col border-b border-border overflow-hidden">
                <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-3 w-3 text-muted-foreground" />
                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">{viewingFlowChat ? 'Flow Chatroom' : 'VOTE CHATROOM'}</h4>
                  </div>
                  {isWalletConnected && (
                    <ChatFilter
                      filter={mandateChatFilter}
                      onFilterChange={setMandateChatFilter}
                      availableHashtags={mandateHashtags}
                      availableRoles={mandateRoles}
                    />
                  )}
                </div>
                {isWalletConnected ? (
                  <>
                    <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-2 scrollbar-thin flex flex-col">
                      <div className="mt-auto space-y-3">
                        {filteredMandateMessages.map((msg) => (
                          <ChatMessage
                            key={msg.id}
                            message={msg}
                            onUpvote={handleUpvote}
                            onDownvote={handleDownvote}
                            onReply={handleReply}
                            onHashtagClick={handleMandateHashtagClick}
                            canInteract={isWalletConnected}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="px-6 py-3 border-t border-border">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="Type a message..." 
                          className="flex-1 bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
                          disabled
                        />
                        <button 
                          className="px-4 py-2 bg-muted text-muted-foreground rounded text-xs hover:bg-muted/80 transition-colors"
                          disabled
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <ChatroomPlaceholder />
                )}
              </div>

              {/* Bottom Split: More Details (left) | Vote (right) */}
              <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border">
                {/* Left: More Details */}
                <div className="p-4 border-r border-border overflow-y-auto" style={{ maxHeight: '150px' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-3 w-3 text-muted-foreground" />
                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {mandate.description}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">Chatroom ID: 52946</p>
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Status</span>
                      <span className={`flex items-center gap-1.5 ${mandate.active ? 'text-green-500' : 'text-muted-foreground'}`}>
                        <Circle className={`h-2 w-2 ${mandate.active ? 'fill-green-500 text-green-500' : 'fill-muted-foreground/40 text-muted-foreground/40'}`} />
                        {mandate.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1.5 border-b border-border/50">
                      <span className="text-muted-foreground">Live Quota</span>
                      <span className="text-foreground">VOTES CAST / QUOTA</span>
                    </div>
                  </div>
                </div>

                {/* Right: Vote */}
                <div className={`p-4 overflow-y-auto ${viewingFlowChat ? 'opacity-40 pointer-events-none' : ''}`} style={{ maxHeight: '250px' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <Vote className="h-3 w-3 text-muted-foreground" />
                    <h4 className="text-xs text-muted-foreground uppercase tracking-wider">VOTE</h4>
                  </div>
                  {!isWalletConnected ? (
                    <div className="flex items-center gap-2 opacity-50">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Connect wallet to vote</span>
                    </div>
                  ) : !currentResults ? (
                    <div className="flex flex-col items-stretch gap-2">
                      <button
                        onClick={() => setPendingVote('yes')}
                        className="border border-green-500/40 rounded px-2 py-3 text-[11px] text-green-500 bg-green-500/5 hover:bg-green-500/15 transition-colors"
                      >
                        YES
                      </button>
                      <button
                        onClick={() => setPendingVote('no')}
                        className="border border-red-500/40 rounded px-2 py-3 text-[11px] text-red-500 bg-red-500/5 hover:bg-red-500/15 transition-colors"
                      >
                        NO
                      </button>
                      <button
                        onClick={() => setPendingVote('abstain')}
                        className="border border-border rounded px-2 py-3 text-[11px] text-muted-foreground bg-muted/10 hover:bg-muted/30 transition-colors"
                      >
                        ABSTAIN
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground mb-3">
                        {currentResults.total}/100 votes cast
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-500 w-16">YES</span>
                        <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                          <div className="h-full bg-green-500/60 rounded" style={{ width: `${(currentResults.yes / currentResults.total) * 100}%` }} />
                        </div>
                        <span className="text-muted-foreground w-8 text-right">{currentResults.yes}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-500 w-16">NO</span>
                        <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                          <div className="h-full bg-red-500/60 rounded" style={{ width: `${(currentResults.no / currentResults.total) * 100}%` }} />
                        </div>
                        <span className="text-muted-foreground w-8 text-right">{currentResults.no}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-muted-foreground w-16">ABSTAIN</span>
                        <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                          <div className="h-full bg-muted-foreground/40 rounded" style={{ width: `${(currentResults.abstain / currentResults.total) * 100}%` }} />
                        </div>
                        <span className="text-muted-foreground w-8 text-right">{currentResults.abstain}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Navigation hints */}
              <div className="px-6 py-3 flex justify-center gap-4 text-xs text-muted-foreground">
                <span>Click another mandate to switch</span>
                <span>•</span>
                <span>Press ESC or click outside to close</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Vote Confirmation Dialog */}
      <AlertDialog open={!!pendingVote} onOpenChange={(open) => !open && setPendingVote(null)}>
        <AlertDialogContent className="font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirm Vote</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Are you sure you want to submit this vote? This part is on-chain and cannot be revoked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Go Back</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVote} className="text-xs">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
