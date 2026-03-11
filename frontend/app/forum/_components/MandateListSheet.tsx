import { useState, useCallback, useMemo, useEffect } from 'react';
import { MessageSquare, FileText, Plus, X } from 'lucide-react';
import { ChatroomPlaceholder } from '@/components/ChatroomPlaceholder';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ChatMessage, ChatMessageData } from '@/components/ChatMessage';
import { getMandateChatMessages } from '@/data/mandateChatMessages';
import { ChatFilter, ChatFilterState } from '@/components/ChatFilter';
import { applyFilter, extractHashtags, extractRoles } from '@/lib/chatFilterUtils';

interface MandateEntry {
  id: number;
  role: number;
}

interface MandateListSheetProps {
  mandate: MandateEntry | null;
  isWalletConnected: boolean;
  onClose: () => void;
}

export function MandateListSheet({ mandate, isWalletConnected, onClose }: MandateListSheetProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);
  const [chatFilter, setChatFilter] = useState<ChatFilterState>({ type: 'none' });
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [params, setParams] = useState(['', '', '']);
  const [anchorHashes, setAnchorHashes] = useState(['']);

  useEffect(() => {
    if (mandate) {
      setChatMessages(getMandateChatMessages(`mandate-list-${mandate.id}`));
      setChatFilter({ type: 'none' });
    }
  }, [mandate?.id]);

  const filteredMessages = useMemo(() => applyFilter(chatMessages, chatFilter), [chatMessages, chatFilter]);
  const availableHashtags = useMemo(() => extractHashtags(chatMessages), [chatMessages]);
  const availableRoles = useMemo(() => extractRoles(chatMessages), [chatMessages]);

  const chatScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => { node.scrollTop = node.scrollHeight; });
      observer.observe(node);
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

  const handleHashtagClick = useCallback((hashtag: string) => {
    setChatFilter({ type: 'hashtag', hashtag });
  }, []);

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
                <p className="text-[10px] text-muted-foreground">Mandate #{mandate.id}</p>
                <h3 className="text-xs text-foreground">[MANDATE NAME]</h3>
              </div>
              <span className="text-xs text-muted-foreground">Role {mandate.role}</span>
            </div>

            {/* Top Split: More Details (left) | Start a New Action (right) */}
            <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border">
              {/* Left: More Details */}
              <div className="p-4 border-r border-border overflow-y-auto" style={{ maxHeight: '180px' }}>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                </p>
                <p className="text-[10px] text-muted-foreground mt-2">Chatroom ID: 73514</p>
              </div>

              {/* Right: Start a New Action */}
              <div className="p-4 overflow-y-auto" style={{ maxHeight: '180px' }}>
                {isWalletConnected ? (
                  <button
                    onClick={() => { setParams(['', '', '']); setAnchorHashes(['']); setActionDialogOpen(true); }}
                    className="flex items-center gap-2 mb-3 cursor-pointer bg-primary text-primary-foreground px-4 py-2 rounded hover:opacity-80 transition-opacity"
                  >
                    <Plus className="h-3 w-3" />
                    <h4 className="text-xs uppercase tracking-wider">Start a New Action</h4>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 mb-3">
                    <Plus className="h-3 w-3 text-muted-foreground/50" />
                    <h4 className="text-xs text-muted-foreground/50 uppercase tracking-wider">Connect wallet to start new actions</h4>
                  </div>
                )}
              </div>
            </div>

            {/* Mandate Chatroom */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/10">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  <h4 className="text-xs text-muted-foreground uppercase tracking-wider">MANDATE CHATROOM</h4>
                </div>
                {isWalletConnected && (
                  <ChatFilter
                    filter={chatFilter}
                    onFilterChange={setChatFilter}
                    availableHashtags={availableHashtags}
                    availableRoles={availableRoles}
                  />
                )}
              </div>
              {isWalletConnected ? (
                <>
                  <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-2 scrollbar-thin flex flex-col">
                    <div className="mt-auto space-y-3">
                      {filteredMessages.map((msg) => (
                        <ChatMessage
                          key={msg.id}
                          message={msg}
                          onUpvote={handleUpvote}
                          onDownvote={handleDownvote}
                          onReply={handleReply}
                          onHashtagClick={handleHashtagClick}
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

            {/* Footer hint */}
            <div className="px-6 py-2 flex justify-center text-xs text-muted-foreground border-t border-border">
              <span>Press ESC or click outside to close</span>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>

      {/* Start a New Action Dialog */}
      {actionDialogOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setActionDialogOpen(false)}>
          <div className="bg-background border border-border rounded-lg w-full max-w-md mx-4 p-6 font-mono relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setActionDialogOpen(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm text-foreground mb-2">Start a New Action</h3>
            <p className="text-xs text-muted-foreground mb-5">
              Please input the params and if needed, paste the relevant anchor hashes
            </p>

            {/* Params */}
            <div className="space-y-3 mb-5">
              {params.map((val, i) => (
                <div key={i}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Param {i + 1}</label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => { const next = [...params]; next[i] = e.target.value; setParams(next); }}
                    className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
                    placeholder={`Enter param ${i + 1}...`}
                  />
                </div>
              ))}
            </div>

            {/* Anchor Hashes */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Anchor Hashes</label>
                <button
                  onClick={() => setAnchorHashes([...anchorHashes, ''])}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              {anchorHashes.map((val, i) => (
                <input
                  key={i}
                  type="text"
                  value={val}
                  onChange={(e) => { const next = [...anchorHashes]; next[i] = e.target.value; setAnchorHashes(next); }}
                  className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
                  placeholder={`Anchor hash ${i + 1}...`}
                />
              ))}
            </div>

            <button
              onClick={() => setActionDialogOpen(false)}
              className="w-full border border-border rounded px-4 py-2.5 text-xs text-foreground bg-muted/10 hover:bg-muted/30 hover:border-foreground/40 transition-colors uppercase tracking-wider"
            >
              Submit
            </button>
          </div>
        </div>
      )}
    </>
  );
}
