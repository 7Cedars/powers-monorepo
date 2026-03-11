import { useState, useCallback, useMemo, useEffect } from 'react';
import { MessageSquare, FileText, Vote, Lock, Circle, ArrowRight, ArrowLeft } from 'lucide-react';
import { ChatroomPlaceholder } from '@/components/ChatroomPlaceholder';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { ChatMessage, ChatMessageData } from '@/components/ChatMessage';
import { getMandateChatMessages } from '@/data/mandateChatMessages';
import { ChatFilter, ChatFilterState } from '@/components/ChatFilter';
import { applyFilter, extractHashtags, extractRoles } from '@/lib/chatFilterUtils';

interface ActionEntry {
  mandateId: number;
  customName: string;
  timeLeft: string;
  active: boolean;
  quorum: number;
}

interface VoteResults {
  total: number;
  yes: number;
  no: number;
  abstain: number;
}

interface ActionSheetProps {
  action: ActionEntry | null;
  isWalletConnected: boolean;
  onClose: () => void;
}

export function ActionSheet({ action, isWalletConnected, onClose }: ActionSheetProps) {
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);
  const [chatFilter, setChatFilter] = useState<ChatFilterState>({ type: 'none' });
  const [viewingFlow, setViewingFlow] = useState(false);

  // Generate stable simulated vote stats per action
  const simulatedVotes = useMemo(() => {
    if (!action) return { total: 0, yes: 0, no: 0, abstain: 0 };
    const seed = action.mandateId * 7 + 13;
    const total = seed % 41 + 40;
    const yes = Math.floor(total * ((seed % 30 + 35) / 100));
    const no = Math.floor((total - yes) * ((seed % 25 + 30) / 100));
    const abstain = total - yes - no;
    return { total, yes, no, abstain };
  }, [action?.mandateId]);

  useEffect(() => {
    if (action) {
      setChatMessages(getMandateChatMessages(`action-${action.mandateId}`));
      setChatFilter({ type: 'none' });
      setVoteResults(null);
      setViewingFlow(false);
    }
  }, [action?.mandateId]);

  const filteredMessages = useMemo(() => applyFilter(chatMessages, chatFilter), [chatMessages, chatFilter]);
  const availableHashtags = useMemo(() => extractHashtags(chatMessages), [chatMessages]);
  const availableRoles = useMemo(() => extractRoles(chatMessages), [chatMessages]);

  const chatScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => {node.scrollTop = node.scrollHeight;});
      observer.observe(node);
      setTimeout(() => observer.disconnect(), 1000);
    }
  }, [action]);

  const handleUpvote = useCallback((id: string) => {
    const updateVotes = (msgs: ChatMessageData[]): ChatMessageData[] =>
    msgs.map((m) => {
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
    msgs.map((m) => {
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
    msgs.map((m) => {
      if (m.id === parentId) {
        const newReply: ChatMessageData = {
          id: `${parentId}-r${Date.now()}`,
          sender: 'anon',
          address: '',
          message: replyText,
          timestamp: new Date(),
          upvotes: 0,
          downvotes: 0
        };
        return { ...m, replies: [...(m.replies || []), newReply] };
      }
      return m.replies ? { ...m, replies: addReply(m.replies) } : m;
    });
    setChatMessages(addReply);
  }, []);

  const handleHashtagClick = useCallback((hashtag: string) => {
    setChatFilter({ type: 'hashtag', hashtag });
  }, []);

  const confirmVote = () => {
    if (pendingVote) {
      const total = Math.floor(Math.random() * 40) + 40;
      const yes = Math.floor(Math.random() * total * 0.6) + Math.floor(total * 0.1);
      const no = Math.floor(Math.random() * (total - yes) * 0.7) + Math.floor((total - yes) * 0.1);
      const abstain = total - yes - no;
      const results = { total: total + 1, yes, no, abstain };
      if (pendingVote === 'yes') results.yes += 1;else
      if (pendingVote === 'no') results.no += 1;else
      results.abstain += 1;
      setVoteResults(results);
      setPendingVote(null);
    }
  };

  return (
    <>
      <Sheet open={!!action} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          className="h-[85vh] bg-background border-t border-border p-0 font-mono">
          
          {action &&
          <div className="h-full flex flex-col animate-fade-in overflow-hidden">
              {/* Sliding container */}
              <div className="h-full flex transition-transform duration-300 ease-in-out" style={{ transform: viewingFlow ? 'translateX(-50%)' : 'translateX(0)', width: '200%' }}>
                
                {/* Panel 1: Action details */}
                <div className="w-1/2 h-full flex flex-col min-w-0">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-2 border-b border-border">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Mandate #{action.mandateId}</p>
                      <h3 className="text-xs text-foreground">{action.customName} + ORIGINAL [MANDATE NAME]</h3>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      
                      <button
                      onClick={() => setViewingFlow(true)}
                      className="flex items-center gap-2 border border-border rounded px-5 py-2.5 text-xs bg-foreground text-background hover:opacity-80 transition-all animate-pulse">
                      
                        VIEW FLOW SEQUENCE
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Top Split: More Details (left) | Vote (right) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border">
                    {/* Left: More Details */}
                    <div className="p-4 border-r border-border overflow-y-auto" style={{ maxHeight: '180px' }}>
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
                      </div>
                      <p className="text-xs text-muted-foreground/70 leading-relaxed italic mb-2">
                        description text + params details
                      </p>
                      <p className="text-xs text-muted-foreground">Quorum: {action.quorum}%</p>
                      <p className="text-xs text-muted-foreground mt-1">Chatroom ID: 48291</p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Circle className={`h-2 w-2 ${action.active ? 'fill-green-500 text-green-500' : 'fill-muted-foreground/40 text-muted-foreground/40'}`} />
                        <span className={`text-xs ${action.active ? 'text-foreground' : 'text-muted-foreground/50'}`}>{action.timeLeft}</span>
                      </div>
                    </div>

                    {/* Right: Vote */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Vote className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">VOTE</h4>
                      </div>
                      {!isWalletConnected ?
                    <div className="space-y-2">
                          <div className="text-xs text-muted-foreground mb-3">
                            {simulatedVotes.total}/100 votes cast
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-500 w-16">YES</span>
                            <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                              <div className="h-full bg-green-500/60 rounded" style={{ width: `${simulatedVotes.yes / simulatedVotes.total * 100}%` }} />
                            </div>
                            <span className="text-muted-foreground w-8 text-right">{simulatedVotes.yes}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-red-500 w-16">NO</span>
                            <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                              <div className="h-full bg-red-500/60 rounded" style={{ width: `${simulatedVotes.no / simulatedVotes.total * 100}%` }} />
                            </div>
                            <span className="text-muted-foreground w-8 text-right">{simulatedVotes.no}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-16">ABSTAIN</span>
                            <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                              <div className="h-full bg-muted-foreground/40 rounded" style={{ width: `${simulatedVotes.abstain / simulatedVotes.total * 100}%` }} />
                            </div>
                            <span className="text-muted-foreground w-8 text-right">{simulatedVotes.abstain}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50 opacity-60">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Connect wallet to participate in voting</span>
                          </div>
                        </div> :
                    !voteResults ?
                    <div className="flex flex-col items-stretch gap-2">
                          <button
                        onClick={() => setPendingVote('yes')}
                        className="border border-green-500/40 rounded px-2 py-3 text-[11px] text-green-500 bg-green-500/5 hover:bg-green-500/15 transition-colors">
                        
                            YES
                          </button>
                          <button
                        onClick={() => setPendingVote('no')}
                        className="border border-red-500/40 rounded px-2 py-3 text-[11px] text-red-500 bg-red-500/5 hover:bg-red-500/15 transition-colors">
                        
                            NO
                          </button>
                          <button
                        onClick={() => setPendingVote('abstain')}
                        className="border border-border rounded px-2 py-3 text-[11px] text-muted-foreground bg-muted/10 hover:bg-muted/30 transition-colors">
                        
                            ABSTAIN
                          </button>
                        </div> :

                    <div className="space-y-2">
                          <div className="text-xs text-muted-foreground mb-3">
                            {voteResults.total}/100 votes cast
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-green-500 w-16">YES</span>
                            <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                              <div className="h-full bg-green-500/60 rounded" style={{ width: `${voteResults.yes / voteResults.total * 100}%` }} />
                            </div>
                            <span className="text-muted-foreground w-8 text-right">{voteResults.yes}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-red-500 w-16">NO</span>
                            <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                              <div className="h-full bg-red-500/60 rounded" style={{ width: `${voteResults.no / voteResults.total * 100}%` }} />
                            </div>
                            <span className="text-muted-foreground w-8 text-right">{voteResults.no}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground w-16">ABSTAIN</span>
                            <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
                              <div className="h-full bg-muted-foreground/40 rounded" style={{ width: `${voteResults.abstain / voteResults.total * 100}%` }} />
                            </div>
                            <span className="text-muted-foreground w-8 text-right">{voteResults.abstain}</span>
                          </div>
                        </div>
                    }
                    </div>
                  </div>

                  {/* Action Chatroom */}
                   <div className="h-[400px] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">VOTEHATROOM</h4>
                      </div>
                      {isWalletConnected &&
                    <ChatFilter
                      filter={chatFilter}
                      onFilterChange={setChatFilter}
                      availableHashtags={availableHashtags}
                      availableRoles={availableRoles} />

                    }
                    </div>
                    {isWalletConnected ?
                  <>
                        <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-2 scrollbar-thin flex flex-col">
                          <div className="mt-auto space-y-3">
                            {filteredMessages.map((msg) =>
                        <ChatMessage
                          key={msg.id}
                          message={msg}
                          onUpvote={handleUpvote}
                          onDownvote={handleDownvote}
                          onReply={handleReply}
                          onHashtagClick={handleHashtagClick}
                          canInteract={isWalletConnected} />

                        )}
                          </div>
                        </div>
                        <div className="px-6 py-3 border-t border-border">
                          <div className="flex gap-2">
                            <input
                          type="text"
                          placeholder="Type a message..."
                          className="flex-1 bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
                          disabled />
                        
                            <button
                          className="px-4 py-2 bg-muted text-muted-foreground rounded text-xs hover:bg-muted/80 transition-colors"
                          disabled>
                          
                              Send
                            </button>
                          </div>
                        </div>
                      </> :

                  <ChatroomPlaceholder />
                  }
                  </div>

                  {/* Footer hint */}
                  <div className="px-6 py-2 flex justify-center text-xs text-muted-foreground border-t border-border">
                    <span>Press ESC or click outside to close</span>
                  </div>
                </div>

                {/* Panel 2: Flow Sequence */}
                <div className="w-1/2 h-full flex flex-col min-w-0">
                    <div className="flex items-center justify-between px-6 py-2 border-b border-border">
                      <h3 className="text-xs text-foreground uppercase tracking-wider">Flow Sequence</h3>
                      <button
                    onClick={() => setViewingFlow(false)}
                    className="flex items-center gap-2 border border-border rounded px-5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors">
                    
                        <ArrowLeft className="h-3 w-3" />
                        Go back to acvotehatroom
                      </button>
                    </div>
                  {/* Top: More Details + Flow Visualisation */}
                  <div className="border-b border-border grid grid-cols-1 md:grid-cols-2 overflow-y-auto" style={{ maxHeight: '40%' }}>
                    {/* Left: More Details */}
                    <div className="p-4 border-r border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
                      </div>
                      <p className="text-xs text-muted-foreground/70 leading-relaxed">
                        Here you will see more details about what this flow does, and what mandates it is comprised of.
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">Chatroom ID: 61837</p>
                    </div>
                    {/* Right: Flow Visualisation */}
                    <div className="p-4 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground/40 italic">flow visualisation - here it needs to be clear if a mandate blocks or allows another mandate  </p>
                    </div>
                  </div>

                  {/* Bottom: Flow Chatroom */}
                  <div className="h-[400px] flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">FLOW CHATROOM</h4>
                      </div>
                    </div>
                    {isWalletConnected ?
                  <>
                        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 scrollbar-thin flex flex-col">
                          <div className="mt-auto space-y-3">
                            {filteredMessages.map((msg) =>
                        <ChatMessage
                          key={`flow-${msg.id}`}
                          message={msg}
                          onUpvote={handleUpvote}
                          onDownvote={handleDownvote}
                          onReply={handleReply}
                          onHashtagClick={handleHashtagClick}
                          canInteract={isWalletConnected} />

                        )}
                          </div>
                        </div>
                        <div className="px-6 py-3 border-t border-border">
                          <div className="flex gap-2">
                            <input
                          type="text"
                          placeholder="Type a message..."
                          className="flex-1 bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
                          disabled />
                        
                            <button
                          className="px-4 py-2 bg-muted text-muted-foreground rounded text-xs hover:bg-muted/80 transition-colors"
                          disabled>
                          
                              Send
                            </button>
                          </div>
                        </div>
                      </> :

                  <ChatroomPlaceholder />
                  }
                  </div>
                </div>

              </div>
            </div>
          }
        </SheetContent>
      </Sheet>

      {/* Vote Confirmation Dialog */}
      <AlertDialog open={!!pendingVote} onOpenChange={(open) => !open && setPendingVote(null)}>
        <AlertDialogContent className="font-mono bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirm Vote</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              Cast your vote as <span className={`font-bold ${pendingVote === 'yes' ? 'text-green-500' : pendingVote === 'no' ? 'text-red-500' : 'text-muted-foreground'}`}>{pendingVote?.toUpperCase()}</span>? This action is blockchain-integrated, and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmVote} className="text-xs">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>);

}