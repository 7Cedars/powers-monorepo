import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

import { NavigationDropdown } from '@/components/NavigationDropdown';

import { RoleSheet } from '@/components/RoleSheet';
import { TreasuryGallery } from '@/components/TreasuryGallery';


import { ChatMessage, ChatMessageData } from '@/components/ChatMessage';
import { WalletModal } from '@/components/WalletModal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogOut, Circle, Lock, MessageSquare } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getDaoConfigBySlug, DaoMandate } from '@/data/daoConfig';
import { DEMO_CHAT_MESSAGES } from '@/data/demoChatMessages';
import { ChatFilter, ChatFilterState } from '@/components/ChatFilter';
import { applyFilter, extractHashtags, extractRoles } from '@/lib/chatFilterUtils';

// Sub-actions for each mandate (3 per mandate)
const MANDATE_ACTIONS: Record<number, {id: number;customName: string;timeLeft: string;active: boolean;quorum: number;result: {yes: number;no: number;abstain: number;outcome: 'PASSED' | 'REJECTED';} | null;}[]> = {
  1: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '0h 47m', active: true, quorum: 42, result: null },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 38, no: 12, abstain: 5, outcome: 'PASSED' } },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 91, result: { yes: 14, no: 31, abstain: 8, outcome: 'REJECTED' } },
  { id: 4, customName: '[CUSTOM NAME]', timeLeft: '1h 20m', active: true, quorum: 58, result: null },
  { id: 5, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 41, no: 9, abstain: 3, outcome: 'PASSED' } }],

  2: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '1h 12m', active: true, quorum: 87, result: null },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 27, no: 27, abstain: 6, outcome: 'REJECTED' } },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 22m', active: true, quorum: 55, result: null },
  { id: 4, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 95, result: { yes: 33, no: 18, abstain: 4, outcome: 'PASSED' } },
  { id: 5, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 82, result: { yes: 15, no: 30, abstain: 9, outcome: 'REJECTED' } },
  { id: 6, customName: '[CUSTOM NAME]', timeLeft: '2h 10m', active: true, quorum: 29, result: null },
  { id: 7, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 46, no: 7, abstain: 2, outcome: 'PASSED' } }],

  3: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 44, no: 8, abstain: 3, outcome: 'PASSED' } },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '2h 05m', active: true, quorum: 33, result: null },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 95, result: { yes: 20, no: 25, abstain: 10, outcome: 'REJECTED' } }],

  4: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 50, no: 5, abstain: 2, outcome: 'PASSED' } },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 88, result: { yes: 10, no: 35, abstain: 12, outcome: 'REJECTED' } },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 38m', active: true, quorum: 61, result: null },
  { id: 4, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 39, no: 11, abstain: 5, outcome: 'PASSED' } },
  { id: 5, customName: '[CUSTOM NAME]', timeLeft: '1h 55m', active: true, quorum: 44, result: null },
  { id: 6, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 93, result: { yes: 22, no: 28, abstain: 6, outcome: 'REJECTED' } },
  { id: 7, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 47, no: 4, abstain: 3, outcome: 'PASSED' } },
  { id: 8, customName: '[CUSTOM NAME]', timeLeft: '0h 15m', active: true, quorum: 72, result: null }],

  5: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '3h 15m', active: true, quorum: 22, result: null },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 42, no: 10, abstain: 5, outcome: 'PASSED' } },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 97, result: { yes: 18, no: 30, abstain: 7, outcome: 'REJECTED' } },
  { id: 4, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 35, no: 16, abstain: 4, outcome: 'PASSED' } }],

  6: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 33, no: 15, abstain: 9, outcome: 'PASSED' } },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '1h 45m', active: true, quorum: 48, result: null },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 92, result: { yes: 22, no: 22, abstain: 11, outcome: 'REJECTED' } },
  { id: 4, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 49, no: 3, abstain: 3, outcome: 'PASSED' } },
  { id: 5, customName: '[CUSTOM NAME]', timeLeft: '0h 30m', active: true, quorum: 65, result: null },
  { id: 6, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 86, result: { yes: 13, no: 33, abstain: 8, outcome: 'REJECTED' } }],

  7: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '0h 10m', active: true, quorum: 76, result: null },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 45, no: 6, abstain: 4, outcome: 'PASSED' } },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 89, result: { yes: 12, no: 38, abstain: 5, outcome: 'REJECTED' } }],

  8: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 40, no: 11, abstain: 4, outcome: 'PASSED' } },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 16, no: 29, abstain: 10, outcome: 'REJECTED' } },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 55m', active: true, quorum: 39, result: null },
  { id: 4, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 37, no: 13, abstain: 5, outcome: 'PASSED' } },
  { id: 5, customName: '[CUSTOM NAME]', timeLeft: '1h 33m', active: true, quorum: 51, result: null }],

  9: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '2h 30m', active: true, quorum: 15, result: null },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 48, no: 3, abstain: 4, outcome: 'PASSED' } },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 94, result: { yes: 20, no: 28, abstain: 7, outcome: 'REJECTED' } },
  { id: 4, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 43, no: 8, abstain: 4, outcome: 'PASSED' } },
  { id: 5, customName: '[CUSTOM NAME]', timeLeft: '0h 42m', active: true, quorum: 60, result: null },
  { id: 6, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 90, result: { yes: 17, no: 31, abstain: 7, outcome: 'REJECTED' } },
  { id: 7, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 44, no: 6, abstain: 5, outcome: 'PASSED' } },
  { id: 8, customName: '[CUSTOM NAME]', timeLeft: '3h 00m', active: true, quorum: 18, result: null }],

  10: [
  { id: 1, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 36, no: 14, abstain: 5, outcome: 'PASSED' } },
  { id: 2, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 85, result: { yes: 11, no: 34, abstain: 10, outcome: 'REJECTED' } },
  { id: 3, customName: '[CUSTOM NAME]', timeLeft: '1h 02m', active: true, quorum: 44, result: null },
  { id: 4, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 100, result: { yes: 40, no: 10, abstain: 5, outcome: 'PASSED' } },
  { id: 5, customName: '[CUSTOM NAME]', timeLeft: '0h 00m', active: false, quorum: 91, result: { yes: 19, no: 26, abstain: 9, outcome: 'REJECTED' } },
  { id: 6, customName: '[CUSTOM NAME]', timeLeft: '0h 28m', active: true, quorum: 53, result: null }]

};

const MANDATES_LIST = [
{ id: 1, role: 3 },
{ id: 2, role: 1 },
{ id: 3, role: 5 },
{ id: 4, role: 2 },
{ id: 5, role: 4 },
{ id: 6, role: 1 },
{ id: 7, role: 3 },
{ id: 8, role: 5 },
{ id: 9, role: 2 },
{ id: 10, role: 4 }];


export default function DaoView() {
  const { slug } = useParams<{slug: string;}>();
  const navigate = useNavigate();
  const { isConnected, isAnonymous, walletAddress, ensName, disconnect } = useWallet();

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessageData[]>(DEMO_CHAT_MESSAGES);
  const [chatFilter, setChatFilter] = useState<ChatFilterState>({ type: 'none' });
  const [anchoredMessages, setAnchoredMessages] = useState<Record<string, string>>({});
  const mainChatRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => {node.scrollTop = node.scrollHeight;});
      observer.observe(node);
      setTimeout(() => observer.disconnect(), 1000);
    }
  }, []);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [mandateRoleFilter, setMandateRoleFilter] = useState<number | null>(null);


  const filteredMessages = useMemo(() => applyFilter(chatMessages, chatFilter), [chatMessages, chatFilter]);
  const availableHashtags = useMemo(() => extractHashtags(chatMessages), [chatMessages]);
  const availableRoles = useMemo(() => extractRoles(chatMessages), [chatMessages]);

  const handleHashtagClick = useCallback((hashtag: string) => {
    setChatFilter({ type: 'hashtag', hashtag });
  }, []);

  const handleAnchor = useCallback((id: string, hash: string) => {
    setAnchoredMessages((prev) => ({ ...prev, [id]: hash }));
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
          sender: ensName || (walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'anon'),
          address: walletAddress || '',
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
  }, [ensName, walletAddress]);

  const daoConfig = getDaoConfigBySlug(slug || '');

  const isWalletConnected = isConnected && !isAnonymous;

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  const displayName = ensName || (walletAddress ? truncateAddress(walletAddress) : '');


  if (!daoConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-mono text-muted-foreground">
        DAO not found.
      </div>);

  }

  const canChat = isWalletConnected;

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines">
      {/* Top Header */}
      <header className="border-b border-border px-3 sm:px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/dao-info" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">
              [DAO NAME]
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {isWalletConnected &&
            <>
                <button
                onClick={() => navigate('/profile')}
                className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors">
                  {displayName}
                </button>
                <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <LogOut className="h-3 w-3" />
                  <span className="hidden sm:inline">DISCONNECT</span>
                </button>
                <span className="text-muted-foreground">|</span>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <Circle className="h-2 w-2 fill-primary text-primary" />
                  <span className="text-foreground">CONNECTED</span>
                </div>
              </>
            }
            {!isWalletConnected &&
            <button
              onClick={() => setWalletModalOpen(true)}
              className="flex items-center gap-2 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-4 transition-all duration-200">
                <Circle className="h-2 w-2 fill-muted-foreground text-muted-foreground" />
                <span className="text-muted-foreground">NOT CONNECTED</span>
              </button>
            }
            <ThemeToggle />
          </div>
        </div>
      </header>
      {/* Sub Header - Page Title */}
      <div className="border-b border-border px-3 sm:px-4 py-2 bg-muted/5">
        <div className="max-w-6xl mx-auto flex items-center gap-2 sm:gap-4">
          <NavigationDropdown currentTitle={daoConfig.name} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-2 sm:px-4 py-4 gap-4 overflow-hidden">

        {/* DAO Summary - full width top */}
        <div className="border border-border">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">DAO SUMMARY</span>
          </div>
          <div className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row gap-4 sm:gap-8 items-start">
            <p className="font-mono text-xs text-muted-foreground leading-relaxed flex-1">
              [CUSTOM DAO SUMMARY TEXT]
            </p>
            <div className="grid grid-cols-3 gap-x-4 sm:gap-x-6 gap-y-2 shrink-0 w-full sm:w-auto">
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Members</span>
                <p className="font-mono text-sm text-foreground">0</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Founded</span>
                <p className="font-mono text-sm text-foreground">dd-mm-yyyy</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Mandates</span>
                <p className="font-mono text-sm text-foreground">0</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Active votes</span>
                <p className="font-mono text-sm text-foreground">0</p>
              </div>
              <div className="space-y-0.5">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">Treasury</span>
                <p className="font-mono text-sm text-foreground">0</p>
              </div>
            </div>
          </div>
        </div>

        {/* THE ACTIVITY OF THE ORG - Unified mandates + actions */}
        <div className="border border-border">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">ACTIVITY OVERVIEW </span>
          </div>
          
          {/* Role Filter */}
          <div className="flex flex-wrap items-center gap-1 px-3 sm:px-4 py-2 border-b border-border bg-muted/5">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mr-2">FILTER:</span>
            {['All Roles', 'Role 1', 'Role 2', 'Role 3', 'Role 4', 'Role 5'].map((label) =>
            <button
              key={label}
              onClick={() => setMandateRoleFilter(label === 'All Roles' ? null : parseInt(label.split(' ')[1]))}
              className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider border transition-colors ${
              label === 'All Roles' && mandateRoleFilter === null || label !== 'All Roles' && mandateRoleFilter === parseInt(label.split(' ')[1]) ?
              'bg-foreground text-background border-foreground' :
              'bg-transparent text-muted-foreground border-border hover:bg-foreground hover:text-background hover:border-foreground'}`
              }>
                {label}
              </button>
            )}
          </div>

          <div className="overflow-auto max-h-[600px]">
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0 bg-background border-b border-border z-10">
                <tr>
                  <th className="px-2 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Mandate</th>
                  <th className="w-[110px] px-2 py-2"></th>
                  <th className="w-[60px] px-2 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Role</th>
                  <th className="px-2 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Actions</th>
                  <th className="w-[90px] px-2 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Time</th>
                  <th className="w-[55px] px-2 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Quorum</th>
                  <th className="w-[90px] px-2 py-2 text-left text-muted-foreground uppercase text-[10px] tracking-wider">Result</th>
                  <th className="w-[80px] px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {MANDATES_LIST.filter((m) => mandateRoleFilter === null || m.role === mandateRoleFilter).map((m) => {
                  const actions = MANDATE_ACTIONS[m.id] || [];
                  return (
                    <>
                      {/* Mandate parent row */}
                      <tr
                        key={`mandate-${m.id}`}
                        className="border-b border-border hover:bg-muted/30 transition-colors h-12 bg-muted/15">
                        
                        <td className="px-2 py-2 text-foreground">
                          <span className="text-muted-foreground mr-1.5">#{m.id}</span>
                          [MANDATE NAME]
                        </td>
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2 text-muted-foreground">{m.role}</td>
                        <td className="px-2 py-2 text-muted-foreground/40 text-[10px]" colSpan={4}>
                          {actions.filter((a) => a.active).length} active · {actions.length} total
                        </td>
                        <td className="px-2 py-2">
                          <button
                            onClick={() => navigate(`/view/${slug}/mandate/${m.id}`)}
                            className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border border-border text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-colors whitespace-nowrap">
                               START A NEW ACTION →
                          </button>
                        </td>
                      </tr>
                      {/* Action sub-rows */}
                      {actions.map((action) =>
                      <tr
                        key={`action-${m.id}-${action.id}`}
                        className={`border-b border-border/30 hover:bg-muted/10 transition-colors h-10 ${!action.active ? 'opacity-60' : ''}`}>
                          
                          <td
                          className="px-2 py-2 text-muted-foreground cursor-pointer hover:text-foreground hover:underline underline-offset-2 transition-colors"
                          onClick={() => navigate(`/view/${slug}/action/${m.id}`)}>
                            <span className="pl-4 border-l border-border/50">{action.customName}</span>
                          </td>
                          <td className="px-2 py-2"></td>
                          <td className="px-2 py-2"></td>
                          <td className="px-2 py-2"></td>
                          <td className="px-2 py-2">
                            <span className="flex items-center gap-1">
                              <Circle className={`h-2 w-2 flex-shrink-0 ${action.active ? 'fill-green-500 text-green-500' : 'fill-muted-foreground/40 text-muted-foreground/40'}`} />
                              <span className={`truncate ${action.active ? 'text-foreground' : 'text-muted-foreground/50'}`}>{action.active ? action.timeLeft : 'ENDED'}</span>
                            </span>
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">{action.quorum}%</td>
                          <td className="px-2 py-2">
                            {action.active ?
                          <span className="text-muted-foreground/50 text-[10px] uppercase">Voting...</span> :
                          action.result ?
                          <span className={`text-[10px] uppercase font-bold ${action.result.outcome === 'PASSED' ? 'text-green-500' : 'text-red-500'}`}>{action.result.outcome}</span> :
                          null}
                          </td>
                          <td className="px-2 py-2">
                            <span className="flex items-center gap-1">
                              <button
                              onClick={() => navigate(`/view/${slug}/action/${m.id}`)}
                              className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border border-border text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-colors whitespace-nowrap">
                                VOTE →
                              </button>
                              <button
                              onClick={() => navigate(`/view/${slug}/action/${m.id}/flow`)}
                              className="font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border border-border text-muted-foreground hover:bg-foreground hover:text-background hover:border-foreground transition-colors whitespace-nowrap">
                                FLOW →
                              </button>
                            </span>
                          </td>
                        </tr>
                      )}
                    </>);

                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Roles */}
        <div className="border border-border">
          <div className="px-4 py-2 border-b border-border bg-muted/50">
            <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">VIEW MEMBER ROLES</span>
          </div>
          <div className="px-2 sm:px-4 py-3 flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) =>
            <button
              key={n}
              onClick={() => setSelectedRole(`Role ${n}`)}
              className="terminal-btn-sm flex-1 text-center">
                Role {n}
              </button>
            )}
            <button
              onClick={() => setSelectedRole('Moderator')}
              className="terminal-btn-sm flex-1 text-center">
              Moderator
            </button>
          </div>
        </div>

        {/* Treasury */}
        <TreasuryGallery />

      </main>

      <RoleSheet
        roleName={selectedRole}
        daoName={daoConfig.name}
        onClose={() => setSelectedRole(null)} />

      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} redirectTo={`/view/${slug}`} />
    </div>);

}