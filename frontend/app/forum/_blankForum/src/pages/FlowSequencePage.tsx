import { useState, useCallback, useEffect } from 'react';
import flowVisualisationImg from '@/assets/flow-visualisation.png';
import { useNavigate, useParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

import { ThemeToggle } from '@/components/ThemeToggle';
import { WalletModal } from '@/components/WalletModal';
import { ChatroomPlaceholder } from '@/components/ChatroomPlaceholder';
import { ChatMessage, ChatMessageData } from '@/components/ChatMessage';
import { getMandateChatMessages } from '@/data/mandateChatMessages';
import { LogOut, Circle, ArrowLeft, MessageSquare, FileText } from 'lucide-react';

export default function FlowSequencePage() {
  const { slug, actionId } = useParams<{slug: string;actionId: string;}>();
  const navigate = useNavigate();
  const { isConnected, isAnonymous, walletAddress, ensName, disconnect } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);
  const chatScrollRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => { node.scrollTop = node.scrollHeight; });
      observer.observe(node);
      setTimeout(() => observer.disconnect(), 1000);
    }
  }, []);

  const isWalletConnected = isConnected && !isAnonymous;
  const displayName = ensName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '');

  useEffect(() => {
    const msgs = getMandateChatMessages('flow-chat');
    setChatMessages(msgs);
  }, []);

  const handleUpvote = useCallback((id: string) => {
    setChatMessages((prev) => prev.map((m) => {
      if (m.id === id) {
        const wasUp = m.userVote === 'up';
        return { ...m, upvotes: wasUp ? m.upvotes - 1 : m.upvotes + 1, downvotes: m.userVote === 'down' ? m.downvotes - 1 : m.downvotes, userVote: wasUp ? null : 'up' as const };
      }
      return m;
    }));
  }, []);

  const handleDownvote = useCallback((id: string) => {
    setChatMessages((prev) => prev.map((m) => {
      if (m.id === id) {
        const wasDown = m.userVote === 'down';
        return { ...m, downvotes: wasDown ? m.downvotes - 1 : m.downvotes + 1, upvotes: m.userVote === 'up' ? m.upvotes - 1 : m.upvotes, userVote: wasDown ? null : 'down' as const };
      }
      return m;
    }));
  }, []);

  const handleReply = useCallback((parentId: string, replyText: string) => {
    const addReply = (messages: ChatMessageData[]): ChatMessageData[] =>
    messages.map((m) => {
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

  const handleHashtagClick = useCallback(() => {}, []);

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
            Go back to DAO
          </button>
          
          
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
            <h3 className="text-foreground uppercase tracking-wider text-base">Flow Sequence</h3>
          </div>

          {/* Flow Visualisation */}
          <div className="border-b border-border p-6 flex flex-col items-center justify-center min-h-[280px] gap-4">
            <img src={flowVisualisationImg} alt="Flow visualisation diagram" className="max-w-full max-h-[400px] object-contain" />
            <p className="text-xs text-muted-foreground/40 italic">flow visualisation - here it needs to be clear if a mandate blocks or allows another mandate</p>
          </div>

          {/* More Details */}
          <div className="border-b border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-3 w-3 text-muted-foreground" />
              <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
            </div>
            <p className="text-xs text-muted-foreground/70 leading-relaxed">Here you will see more details about what this flow does, and what mandates it is comprised of.</p>
            
            <p className="text-xs text-muted-foreground mt-1">Flow ID: 48291</p>
          </div>

          {/* Flow Chatroom */}
          <div className="h-[400px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/50">
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-3 w-3 text-muted-foreground" />
                  <h4 className="text-muted-foreground uppercase tracking-wider text-base">FLOW CHATROOM</h4>
                </div>
                <p className="text-[10px] text-muted-foreground/60 ml-5">Chatroom ID: 61837</p>
              </div>
            </div>
            {isWalletConnected ?
            <>
                <div ref={chatScrollRef} className="flex-1 min-h-0 overflow-y-auto px-6 py-2 scrollbar-thin flex flex-col">
                  <div className="mt-auto space-y-3">
                    {chatMessages.map((msg) =>
                  <ChatMessage key={`flow-${msg.id}`} message={msg} onUpvote={handleUpvote} onDownvote={handleDownvote} onReply={handleReply} onHashtagClick={handleHashtagClick} canInteract={isWalletConnected} />
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

      
      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>);

}