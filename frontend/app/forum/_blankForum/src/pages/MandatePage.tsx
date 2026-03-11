import { useState, useCallback, useMemo, useEffect } from 'react';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useNavigate, useParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

import { ThemeToggle } from '@/components/ThemeToggle';
import { WalletModal } from '@/components/WalletModal';
import { ChatroomPlaceholder } from '@/components/ChatroomPlaceholder';
import { ChatMessage, ChatMessageData } from '@/components/ChatMessage';
import { ChatFilter, ChatFilterState } from '@/components/ChatFilter';
import { applyFilter, extractHashtags, extractRoles } from '@/lib/chatFilterUtils';
import { getMandateChatMessages } from '@/data/mandateChatMessages';
import { LogOut, Circle, MessageSquare, FileText, Plus, X, ArrowLeft } from 'lucide-react';

const MANDATE_DATA = {
  id: 1,
  role: 3,
  lastActive: 42
};

export default function MandatePage() {
  const { slug, mandateId } = useParams<{slug: string;mandateId: string;}>();
  const navigate = useNavigate();
  const { isConnected, isAnonymous, walletAddress, ensName, disconnect } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);
  const [chatFilter, setChatFilter] = useState<ChatFilterState>({ type: 'none' });
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [params, setParams] = useState(['', '', '']);
  const [anchorHashes, setAnchorHashes] = useState(['']);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  const isWalletConnected = isConnected && !isAnonymous;
  const displayName = ensName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '');

  const mandate = MANDATE_DATA;

  useEffect(() => {
    setChatMessages(getMandateChatMessages(`mandate-list-${mandate.id}`));
    setChatFilter({ type: 'none' });
  }, []);

  const filteredMessages = useMemo(() => applyFilter(chatMessages, chatFilter), [chatMessages, chatFilter]);
  const availableHashtags = useMemo(() => extractHashtags(chatMessages), [chatMessages]);
  const availableRoles = useMemo(() => extractRoles(chatMessages), [chatMessages]);

  const chatScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => {node.scrollTop = node.scrollHeight;});
      observer.observe(node);
      setTimeout(() => observer.disconnect(), 1000);
    }
  }, []);

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

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines font-mono">
      {/* Top Header */}
      <header className="border-b border-border px-3 sm:px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/dao-info" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">[DAO NAME]</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {isWalletConnected ?
            <>
                <button onClick={() => navigate('/profile')} className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors">
                  {displayName}
                </button>
                <button onClick={handleDisconnect} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <LogOut className="h-3 w-3" />
                  <span className="hidden sm:inline">DISCONNECT</span>
                </button>
                <span className="text-muted-foreground">|</span>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Circle className="h-2 w-2 fill-primary text-primary" />
                  <span className="text-foreground">CONNECTED</span>
                </div>
              </> :

            <button onClick={() => setWalletModalOpen(true)} className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-all duration-200">
                <Circle className="h-2 w-2 fill-muted-foreground text-muted-foreground" />
                <span className="text-muted-foreground">NOT CONNECTED</span>
              </button>
            }
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Sub Header */}
      <div className="border-b border-border px-4 py-2 bg-muted/5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
           <button onClick={() => navigate(`/view/${slug}`)} className="terminal-btn-sm flex items-center gap-2">
            <ArrowLeft className="h-3 w-3" />
            Back to DAO
          </button>
          
          
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
            <div>
              <p className="text-muted-foreground text-sm">Mandate #{mandate.id}</p>
              <h3 className="text-foreground text-base">[MANDATE NAME]</h3>
            </div>
            <span className="text-xs text-muted-foreground">Role {mandate.role}</span>
          </div>

          {/* More Details + Start Action Row */}
          <div className="border-b border-border flex flex-col sm:flex-row">
            {/* More Details - Left */}
            <div className="flex-1 p-4 overflow-y-auto sm:border-r border-b sm:border-b-0 border-border" style={{ maxHeight: '180px' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
              </p>
              
            </div>
            {/* Start a New Action - Right */}
            <div className="p-4 flex items-center justify-center sm:w-80 shrink-0">
              {isWalletConnected ?
              <button
                onClick={() => {setParams(['', '', '']);setAnchorHashes(['']);setActionDialogOpen(true);}}
                className="flex items-center gap-2 cursor-pointer bg-primary text-primary-foreground px-6 py-3 rounded hover:opacity-80 transition-opacity">
                
                  <Plus className="h-4 w-4" />
                  <h4 className="text-sm uppercase tracking-wider">Start a New Action</h4>
                </button> :

              <div className="flex items-center gap-2">
                  <Plus className="h-3 w-3 text-muted-foreground/50" />
                  <h4 className="text-xs text-muted-foreground/50 uppercase tracking-wider">Connect wallet to start new actions</h4>
                </div>
              }
            </div>
          </div>

          {/* Mandate Chatroom */}
          <div className="h-[400px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/50">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  <h4 className="text-muted-foreground uppercase tracking-wider text-base">MANDATE CHATROOM</h4>
                </div>
                <p className="text-[10px] text-muted-foreground/60 ml-5">Chatroom ID: 73514</p>
              </div>
              {isWalletConnected &&
              <ChatFilter filter={chatFilter} onFilterChange={setChatFilter} availableHashtags={availableHashtags} availableRoles={availableRoles} />
              }
            </div>
            {isWalletConnected ?
            <>
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-2 scrollbar-thin flex flex-col">
                  <div className="mt-auto space-y-3">
                    {filteredMessages.map((msg) =>
                  <ChatMessage key={msg.id} message={msg} onUpvote={handleUpvote} onDownvote={handleDownvote} onReply={handleReply} onHashtagClick={handleHashtagClick} canInteract={isWalletConnected} />
                  )}
                  </div>
                </div>
                <div className="px-6 py-3 border-t border-border">
                  <div className="flex gap-2">
                    <input type="text" placeholder="Type a message..." className="flex-1 bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors" disabled />
                    <button className="terminal-btn-sm disabled:opacity-50 disabled:cursor-not-allowed" disabled>Send</button>
                  </div>
                </div>
              </> :

            <ChatroomPlaceholder />
            }
          </div>
        </div>
      </main>
  

      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} redirectTo={`/view/${slug}/mandate/${mandateId}`} />

      {/* Start a New Action Dialog */}
      {actionDialogOpen &&
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={() => setActionDialogOpen(false)}>
          <div className="bg-background border border-border rounded-lg w-full max-w-md mx-4 p-6 font-mono relative" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setActionDialogOpen(false)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>

            <h3 className="text-sm text-foreground mb-2">Start a New Action</h3>
            <p className="text-xs text-muted-foreground mb-5">Please input the params and if needed, paste the relevant anchor hashes</p>

            <div className="space-y-3 mb-5">
              {params.map((val, i) =>
            <div key={i}>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Param {i + 1}</label>
                  <input
                type="text"
                value={val}
                onChange={(e) => {const next = [...params];next[i] = e.target.value;setParams(next);}}
                className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
                placeholder={`Enter param ${i + 1}...`} />
              
                </div>
            )}
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Anchor Hashes</label>
                <button onClick={() => setAnchorHashes([...anchorHashes, ''])} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-3 w-3" />
                </button>
              </div>
              {anchorHashes.map((val, i) =>
            <input
              key={i}
              type="text"
              value={val}
              onChange={(e) => {const next = [...anchorHashes];next[i] = e.target.value;setAnchorHashes(next);}}
              className="w-full bg-background border border-border rounded px-3 py-2 text-xs focus:outline-none focus:border-foreground/50 transition-colors"
              placeholder={`Anchor hash ${i + 1}...`} />

            )}
            </div>

            <button onClick={() => setSubmitConfirmOpen(true)} className="terminal-btn-sm w-full">
              Submit
            </button>
          </div>
        </div>
      }

      {/* Submit Confirmation Dialog */}
      {submitConfirmOpen &&
      <div className="fixed inset-0 z-[250] bg-black/80" />
      }
      <AlertDialog open={submitConfirmOpen} onOpenChange={setSubmitConfirmOpen}>
        <AlertDialogContent className="font-mono bg-background border-border z-[300]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Confirm Submission</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">
              This will submit a new action. This is a <span className="font-bold text-foreground">blockchain transaction</span> and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {setSubmitConfirmOpen(false);setActionDialogOpen(false);}} className="text-xs">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}