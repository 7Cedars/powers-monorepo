import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

import { ThemeToggle } from '@/components/ThemeToggle';

import { WalletModal } from '@/components/WalletModal';
import { ChatroomPlaceholder } from '@/components/ChatroomPlaceholder';
import { ChatMessage, ChatMessageData } from '@/components/ChatMessage';
import { ChatFilter, ChatFilterState } from '@/components/ChatFilter';
import { applyFilter, extractHashtags, extractRoles } from '@/lib/chatFilterUtils';
import { getMandateChatMessages } from '@/data/mandateChatMessages';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { LogOut, Circle, Lock, MessageSquare, FileText, Vote, ArrowRight, ArrowLeft } from 'lucide-react';

// All action items matching DaoView LATEST_ACTIONS
const ALL_ACTIONS = [
  { mandateId: 17, customName: '[CUSTOM NAME]', timeLeft: '0h 47m', active: true, quorum: 42, role: 3, result: null },
  { mandateId: 3, customName: '[CUSTOM NAME]', timeLeft: '1h 12m', active: true, quorum: 87, role: 1, result: null },
  { mandateId: 29, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 15, role: 5, result: { yes: 38, no: 12, abstain: 5, total: 55, outcome: 'PASSED' as const } },
  { mandateId: 8, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 63, role: 2, result: { yes: 14, no: 31, abstain: 8, total: 53, outcome: 'REJECTED' as const } },
  { mandateId: 34, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 91, role: 4, result: { yes: 27, no: 27, abstain: 6, total: 60, outcome: 'REJECTED' as const } },
];

export default function ActionPage() {
  const { slug, actionId } = useParams<{slug: string; actionId: string;}>();
  const navigate = useNavigate();
  const { isConnected, isAnonymous, walletAddress, ensName, disconnect } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [voteResults, setVoteResults] = useState<{total: number;yes: number;no: number;abstain: number;} | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>([]);
  const [chatFilter, setChatFilter] = useState<ChatFilterState>({ type: 'none' });


  const isWalletConnected = isConnected && !isAnonymous;
  const displayName = ensName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : '');
  const action = ALL_ACTIONS.find(a => a.mandateId === Number(actionId)) || ALL_ACTIONS[0];
  const isInactive = !action.active;

  const simulatedVotes = useMemo(() => {
    const seed = action.mandateId * 7 + 13;
    const total = seed % 41 + 40;
    const yes = Math.floor(total * ((seed % 30 + 35) / 100));
    const no = Math.floor((total - yes) * ((seed % 25 + 30) / 100));
    const abstain = total - yes - no;
    return { total, yes, no, abstain };
  }, []);

  useEffect(() => {
    setChatMessages(getMandateChatMessages(`action-${action.mandateId}`));
    setChatFilter({ type: 'none' });
    setVoteResults(null);

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

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  const VoteDisplay = ({ votes }: {votes: {total: number;yes: number;no: number;abstain: number;};}) =>
  <div className="space-y-2">
      <div className="text-xs text-muted-foreground mb-3">{votes.total}/100 votes cast</div>
      {[
    { label: 'YES', value: votes.yes, color: 'text-green-500', bg: 'bg-green-500/60' },
    { label: 'NO', value: votes.no, color: 'text-red-500', bg: 'bg-red-500/60' },
    { label: 'ABSTAIN', value: votes.abstain, color: 'text-muted-foreground', bg: 'bg-muted-foreground/40' }].
    map((v) =>
    <div key={v.label} className="flex items-center gap-2 text-xs">
          <span className={`${v.color} w-16`}>{v.label}</span>
          <div className="flex-1 h-2 bg-muted/20 rounded overflow-hidden">
            <div className={`h-full ${v.bg} rounded`} style={{ width: `${v.value / votes.total * 100}%` }} />
          </div>
          <span className="text-muted-foreground w-8 text-right">{v.value}</span>
        </div>
    )}
    </div>;


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
          <div className="h-full flex flex-col overflow-hidden">
              {/* Action details */}
              <div className="h-full flex flex-col min-w-0">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Mandate #{action.mandateId} + ORIGINAL [MANDATE NAME]</p>
                    <h3 className="text-foreground text-base mx-0">[CUSTOM MANDATE NAME]</h3>
                  </div>
                   <button
                  onClick={() => navigate(`/view/${slug}/action/${action.mandateId}/flow`)}
                  className="terminal-btn-sm flex items-center gap-2 bg-foreground text-background hover:bg-foreground/80 hover:text-background">
                  
                    VIEW FLOW SEQUENCE
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Top Split: More Details | Vote */}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] border-b border-border">
                  {/* Left: More Details */}
                  <div className="p-4 md:border-r border-border">
                    <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4>
                    </div>
                    <p className="text-xs text-muted-foreground/70 leading-relaxed italic mb-2">description text + params details</p>
                    
                    <p className="text-xs text-muted-foreground">Action ID: 73945</p>
                    <p className="text-xs text-muted-foreground">Quorum: {action.quorum}%</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      
                      <span className="text-xs text-muted-foreground">Time Left:</span>
                      <span className={`text-xs ${action.active ? 'text-foreground' : 'text-muted-foreground/50'}`}>{action.timeLeft}</span>
                    </div>
                    </div>
                  </div>

                  {/* Right: Vote + Vote Overview */}
                  <div className="flex flex-col">
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Vote className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">VOTE</h4>
                      </div>
                      {isInactive && action.result ?
                    <>
                          <VoteDisplay votes={{ total: action.result.total, yes: action.result.yes, no: action.result.no, abstain: action.result.abstain }} />
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Voting has ended</span>
                            <span className={`text-xs font-bold ml-auto ${action.result.outcome === 'PASSED' ? 'text-green-500' : 'text-red-500'}`}>{action.result.outcome}</span>
                          </div>
                        </> :
                    !isWalletConnected ?
                    <>
                          <VoteDisplay votes={simulatedVotes} />
                          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border/50 opacity-60">
                            <Lock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Connect wallet to participate in voting</span>
                          </div>
                        </> :
                    !voteResults ?
                    <div className="flex flex-col items-stretch gap-2">
                          <button onClick={() => setPendingVote('yes')} className="terminal-btn-sm bg-green-500/20 !border-green-500 !text-green-500 hover:bg-green-500/30 py-3">YES</button>
                          <button onClick={() => setPendingVote('no')} className="terminal-btn-sm bg-red-500/20 !border-red-500 !text-red-500 hover:bg-red-500/30 py-3">NO</button>
                          <button onClick={() => setPendingVote('abstain')} className="terminal-btn-sm-muted bg-muted/30 hover:bg-muted/50 py-3">ABSTAIN</button>
                        </div> :

                    <VoteDisplay votes={voteResults} />
                    }
                    </div>
                    {/* Vote Overview */}
                    <div className="p-4 border-t border-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Vote className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-xs text-muted-foreground uppercase tracking-wider">VOTE OVERVIEW</h4>
                      </div>
                      <div className="max-h-[120px] overflow-y-auto scrollbar-thin space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 uppercase tracking-wider mb-1 px-0.5">
                          <span className="flex-1">Address</span>
                          <span className="w-20 text-center">Vote</span>
                          <span className="w-28 text-right">Date/Time</span>
                        </div>
                        {[
                      { addr: 'vitalik.eth', vote: 'yes', date: '02-03-2026 14:23' },
                      { addr: '0x1a2B...9f4E', vote: 'yes', date: '02-03-2026 14:41' },
                      { addr: 'punk6529.eth', vote: 'no', date: '02-03-2026 15:07' },
                      { addr: '0x7cF3...2bA1', vote: 'yes', date: '02-03-2026 15:32' },
                      { addr: 'sassal.eth', vote: 'abstain', date: '02-03-2026 16:18' },
                      { addr: '0xdE4a...8c7F', vote: 'yes', date: '03-03-2026 09:05' },
                      { addr: 'brantly.eth', vote: 'no', date: '03-03-2026 10:44' },
                      { addr: '0x3fB2...1dC9', vote: 'yes', date: '03-03-2026 11:22' },
                      { addr: 'griff.eth', vote: 'yes', date: '03-03-2026 13:51' },
                      { addr: '0xaA91...4e2D', vote: 'abstain', date: '03-03-2026 14:09' },
                      { addr: '0x52cE...7fB3', vote: 'no', date: '04-03-2026 08:33' },
                      { addr: 'superphiz.eth', vote: 'yes', date: '04-03-2026 09:17' }].
                      map((v, i) =>
                      <div key={i} className="flex items-center justify-between text-[11px]">
                            <span
                          className="flex-1 text-foreground font-mono hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
                          onClick={() => navigate(`/user/${v.addr}`)}>
                              {v.addr}
                            </span>
                            <span className={`w-20 text-center uppercase ${v.vote === 'yes' ? 'text-green-500' : v.vote === 'no' ? 'text-red-500' : 'text-muted-foreground'}`}>{v.vote}</span>
                            <span className="w-28 text-right text-muted-foreground/70">{v.date}</span>
                          </div>
                      )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Chatroom */}
                <div className="h-[400px] flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/50">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-3 w-3 text-muted-foreground" />
                        <h4 className="text-muted-foreground uppercase tracking-wider text-base">VOTE CHATROOM</h4>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 ml-5">Chatroom ID: 48291</p>
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
        </div>
        </div>
      </main>

      
      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} redirectTo={`/view/${slug}/action/17`} />

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
    </div>);

}