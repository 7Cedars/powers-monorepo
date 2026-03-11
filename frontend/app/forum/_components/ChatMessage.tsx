import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown, MessageSquare, ChevronDown, ChevronRight, Anchor, Check, Copy, Flag } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { ChatUserHoverCard } from '@/components/ChatUserHoverCard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { generateAnchorHash } from '@/lib/anchorHash';

export interface ChatMessageData {
  id: string;
  sender: string;
  address: string;
  message: string;
  timestamp: Date;
  upvotes: number;
  downvotes: number;
  role?: string;
  replies?: ChatMessageData[];
  userVote?: 'up' | 'down' | null;
  profileLink?: string;
}

interface ChatMessageProps {
  message: ChatMessageData;
  onUpvote: (id: string) => void;
  onDownvote: (id: string) => void;
  onReply: (id: string, replyText: string) => void;
  onHashtagClick?: (hashtag: string) => void;
  onAnchor?: (id: string, hash: string) => void;
  anchoredHash?: string | null;
  chatroomContext?: string;
  isReply?: boolean;
  canInteract: boolean;
}

export function ChatMessage({
  message,
  onUpvote,
  onDownvote,
  onReply,
  onHashtagClick,
  onAnchor,
  anchoredHash,
  chatroomContext = 'main',
  isReply = false,
  canInteract,
}: ChatMessageProps) {
  const navigate = useNavigate();
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplies, setShowReplies] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [justCopied, setJustCopied] = useState(false);
  const { isConnected, isAnonymous } = useWallet();

  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagged, setFlagged] = useState(false);

  const canVote = isConnected && !isAnonymous;
  const hasReplies = message.replies && message.replies.length > 0;
  const isAnchored = !!anchoredHash;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const handleAnchor = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    try {
      const hash = await generateAnchorHash(message, chatroomContext);
      await navigator.clipboard.writeText(hash);
      onAnchor?.(message.id, hash);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    } catch (err) {
      console.error('Failed to generate anchor hash:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyHash = async () => {
    if (anchoredHash) {
      await navigator.clipboard.writeText(anchoredHash);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  };

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      onReply(message.id, replyText.trim());
      setReplyText('');
      setShowReplyInput(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitReply();
    }
    if (e.key === 'Escape') {
      setShowReplyInput(false);
      setReplyText('');
    }
  };

  const renderMessageText = (text: string) => {
    return text.split(/(#\w+)/g).map((part, i) =>
      part.startsWith('#') ? (
        <button
          key={i}
          onClick={() => onHashtagClick?.(part.slice(1))}
          className="text-primary hover:underline"
        >
          {part}
        </button>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <div className={`font-mono text-sm ${isReply ? 'ml-6 border-l border-border pl-3' : ''} ${isAnchored ? 'border-l-2 border-l-primary pl-2' : ''}`}>
      <div className="group">
        {/* Main message row */}
        <div className="flex items-start gap-2">
          {/* Vote buttons */}
          <div className="flex flex-col items-center gap-0.5 pt-0.5">
            <button
              onClick={() => canVote && onUpvote(message.id)}
              disabled={!canVote}
              className={`transition-colors ${
                message.userVote === 'up'
                  ? 'text-primary'
                  : canVote
                  ? 'text-muted-foreground hover:text-primary'
                  : 'text-muted-foreground/30 cursor-not-allowed'
              }`}
              title={canVote ? 'Upvote' : 'Connect wallet to vote'}
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <span className={`text-xs ${
              message.upvotes - message.downvotes > 0 
                ? 'text-primary' 
                : message.upvotes - message.downvotes < 0 
                ? 'text-destructive' 
                : 'text-muted-foreground'
            }`}>
              {message.upvotes - message.downvotes}
            </span>
            <button
              onClick={() => canVote && onDownvote(message.id)}
              disabled={!canVote}
              className={`transition-colors ${
                message.userVote === 'down'
                  ? 'text-destructive'
                  : canVote
                  ? 'text-muted-foreground hover:text-destructive'
                  : 'text-muted-foreground/30 cursor-not-allowed'
              }`}
              title={canVote ? 'Downvote' : 'Connect wallet to vote'}
            >
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>

          {/* Message content */}
          <div className="flex-1 min-w-0">
            <div>
              <span className="text-muted-foreground">[{formatTime(message.timestamp)}]</span>
              {message.role?.toLowerCase() === 'moderator' && (
                <span className="text-destructive text-xs ml-2">[{message.role}]</span>
              )}
               {(() => {
                 const profilePath = message.sender.endsWith('.eth')
                   ? `/user/${message.sender}`
                   : message.address
                     ? `/user/${message.address}`
                     : null;
                 return profilePath ? (
                   <ChatUserHoverCard sender={message.sender} address={message.address} profilePath={profilePath}>
                     <span
                       onClick={() => navigate(profilePath)}
                       className="text-foreground text-glow ml-2 hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer"
                     >
                       {message.sender}:
                     </span>
                   </ChatUserHoverCard>
                 ) : (
                   <span className="text-foreground text-glow ml-2">{message.sender}:</span>
                 );
               })()}
              <span className="text-muted-foreground ml-2">
                {renderMessageText(message.message)}
              </span>
              {isAnchored && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <Anchor className="h-3 w-3 text-primary" />
                  <button
                    onClick={handleCopyHash}
                    className="text-[10px] text-primary hover:underline font-mono"
                    title="Copy anchor hash"
                  >
                    {justCopied ? 'copied!' : anchoredHash!.slice(0, 10) + '...'}
                  </button>
                </span>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {canInteract && (
                <button
                  onClick={() => setShowReplyInput(!showReplyInput)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <MessageSquare className="h-3 w-3" />
                  Reply
                </button>
              )}
              {canInteract && !isAnchored && (
                <button
                  onClick={handleAnchor}
                  disabled={isGenerating}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  title="Generate anchor hash for this message"
                >
                  <Anchor className="h-3 w-3" />
                  {isGenerating ? 'Hashing...' : 'Anchor'}
                </button>
              )}
              {isAnchored && (
                <button
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 text-xs text-primary transition-colors"
                  title="Copy anchor hash"
                >
                  {justCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {justCopied ? 'Copied' : 'Copy Hash'}
                </button>
              )}
              {hasReplies && (
                <button
                  onClick={() => setShowReplies(!showReplies)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showReplies ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  {message.replies!.length} {message.replies!.length === 1 ? 'reply' : 'replies'}
                </button>
              )}
              {canInteract && (
                <button
                  onClick={() => setShowFlagDialog(true)}
                  className={`flex items-center gap-1 text-xs transition-colors ${
                    flagged
                      ? 'text-destructive'
                      : 'text-muted-foreground hover:text-destructive'
                  }`}
                  title={flagged ? 'Message reported' : 'Report this message'}
                >
                  <Flag className="h-3 w-3" />
                  {flagged ? 'Reported' : 'Flag'}
                </button>
              )}
            </div>

            {/* Flag confirmation dialog */}
            <AlertDialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <Flag className="h-4 w-4 text-destructive" />
                    Report Message
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to report this message? Moderators will review this report and take necessary action if the content violates community guidelines.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => setFlagged(true)}
                  >
                    Report
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Reply input */}
            {showReplyInput && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-muted-foreground">&gt;</span>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`reply to ${message.sender}...`}
                  className="flex-1 bg-transparent border-b border-border outline-none text-xs text-foreground placeholder:text-muted-foreground py-1"
                  autoFocus
                />
                <button
                  onClick={handleSubmitReply}
                  disabled={!replyText.trim()}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  SEND
                </button>
                <button
                  onClick={() => { setShowReplyInput(false); setReplyText(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  ESC
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Replies */}
        {hasReplies && showReplies && (
          <div className="mt-2 space-y-2">
            {message.replies!.map((reply) => (
              <ChatMessage
                key={reply.id}
                message={reply}
                onUpvote={onUpvote}
                onDownvote={onDownvote}
                onReply={onReply}
                onHashtagClick={onHashtagClick}
                onAnchor={onAnchor}
                anchoredHash={null}
                chatroomContext={chatroomContext}
                isReply
                canInteract={canInteract}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
