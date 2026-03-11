import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { getUserProfile } from '@/data/userProfiles';

import { NavigationDropdown } from '@/components/NavigationDropdown';
import { WalletModal } from '@/components/WalletModal';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Award, Link2, ExternalLink, LogOut, Circle, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getOrangeAvatar } from '@/lib/orangeAvatars';

// Default mock data for fields not in userProfiles.ts
const DEFAULT_STATS = {
  totalMessages: '#',
  avgMessagesPerWeek: '#',
  daysActive: 0,
  lastActive: '—'
};

const DEFAULT_TOP_MESSAGES = [
{ id: '1', content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...', upvotes: 12, dao: 'DAO #0', daoSlug: 'primary-dao', mandateId: 'p16' },
{ id: '2', content: 'Sed do eiusmod tempor incididunt ut labore et dolore...', upvotes: 8, dao: 'DAO #1', daoSlug: 'sub-dao-1', mandateId: 'd1' }];


const DEFAULT_LINKED_ACCOUNTS: {platform: string;handle: string;url: string;verified: boolean;}[] = [];

export default function UserProfile() {
  const { username } = useParams<{username: string;}>();
  const navigate = useNavigate();
  const { isConnected, isAnonymous, walletAddress, ensName, disconnect } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);

  const isWalletConnected = isConnected && !isAnonymous;
  const profile = username ? getUserProfile(username) : undefined;

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const displayAddress = walletAddress ? truncateAddress(walletAddress) : '';

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-mono text-muted-foreground">
        User not found.
      </div>);

  }

  const linkedAccounts = DEFAULT_LINKED_ACCOUNTS.length > 0 ?
  DEFAULT_LINKED_ACCOUNTS :
  profile.ensName ?
  [{ platform: 'ENS', handle: profile.ensName, url: 'https://ens.domains/', verified: true }] :
  [];

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines">
      {/* Top Header */}
      <header className="border-b border-border px-3 sm:px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/dao-info" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">[DAO NAME]</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {isWalletConnected &&
            <>
                <button onClick={() => navigate('/profile')} className="text-xs text-muted-foreground hover:text-foreground font-mono transition-colors">
                  {ensName || displayAddress}
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
              </>
            }
            {!isWalletConnected &&
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
          <NavigationDropdown currentTitle={`USER: ${(profile.ensName || profile.displayName).toUpperCase()}`} />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <ScrollArea className="h-full">
          <div className="space-y-8">

            {/* Profile Header — read-only */}
            <section className="border border-border p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* Avatar */}
                <div className="shrink-0 self-start">
                  <Avatar className="h-20 w-20 border border-border">
                    <AvatarImage src={getOrangeAvatar(profile.address)} alt="Profile picture" />
                    <AvatarFallback className="bg-muted/30">
                      <img src={getOrangeAvatar(profile.address)} alt="avatar" className="h-full w-full object-cover" />
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="space-y-2 flex-1">
                  <h2 className="font-mono text-base text-foreground text-glow uppercase tracking-wider">{profile.displayName}</h2>
                  
                  <p className="font-mono text-xs text-muted-foreground max-w-lg">{profile.bio}</p>
                  <p className="font-mono text-xs flex items-center gap-1.5">
                    <span className="text-muted-foreground">ZKPassport Status:</span>
                    <span className="text-green-500">Verified</span>
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {linkedAccounts.map((account, i) =>
                    <a key={i} href={account.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <Link2 className="h-3 w-3" />
                        {account.platform}: {account.handle}
                        <ExternalLink className="h-2.5 w-2.5" />
                        <span className={`text-[10px] ${account.verified ? 'text-green-500' : 'text-muted-foreground/60'}`}>
                          [{account.verified ? '✓' : 'pending'}]
                        </span>
                      </a>
                    )}
                  </div>
                </div>
                <div className="font-mono text-xs text-muted-foreground text-right space-y-1">
                  <p>Last active: {DEFAULT_STATS.lastActive}</p>
                  <p>{DEFAULT_STATS.totalMessages} messages total</p>
                  <p>{DEFAULT_STATS.avgMessagesPerWeek} avg/week</p>
                </div>
              </div>
            </section>

            {/* Activity Stats */}
            <section className="border border-border p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-center">
                <div className="space-y-1">
                  <p className="text-sm text-foreground text-glow">{DEFAULT_STATS.lastActive}</p>
                  <p className="text-muted-foreground uppercase tracking-wider text-sm">Last Active</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-foreground text-glow">{DEFAULT_STATS.totalMessages}</p>
                  <p className="text-muted-foreground uppercase tracking-wider text-sm">Messages</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-foreground text-glow">{DEFAULT_STATS.avgMessagesPerWeek}</p>
                  <p className="text-muted-foreground uppercase tracking-wider text-sm">Avg / Week</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-foreground text-glow">#</p>
                  <p className="text-muted-foreground uppercase tracking-wider text-sm">Votes Cast</p>
                </div>
              </div>
            </section>

            {/* On-Chain Section */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* DAO Roles */}
                <div className="border border-border space-y-3">
                  <h4 className="font-mono text-foreground flex items-center gap-2 uppercase tracking-wider text-sm px-4 py-3 border-b border-border bg-muted/50">
                    <Award className="h-4 w-4" /> DAO Roles
                  </h4>
                  <div className="space-y-2 p-4">
                    {profile.daoRoles.map((role, i) =>
                    <div key={i} className="font-mono text-xs text-muted-foreground flex justify-between">
                        <span><span className="text-foreground">{role.role}</span> @ {role.dao}</span>
                        <span>since {role.since}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Top Messages */}
                <div className="border border-border space-y-4">
                  <h4 className="font-mono text-foreground flex items-center gap-2 uppercase tracking-wider text-sm px-4 py-3 border-b border-border bg-muted/50">
                    <MessageSquare className="h-4 w-4" /> Top Upvoted Messages
                  </h4>
                  <div className="space-y-3 p-4">
                    {DEFAULT_TOP_MESSAGES.map((msg, index) =>
                    <div key={msg.id} className="border border-border/50 rounded p-3 space-y-2 hover:border-border transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">#{index + 1} — {msg.dao}</span>
                          <span className="font-mono text-xs text-foreground font-medium flex items-center gap-1">
                            ↑ {msg.upvotes}
                          </span>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground leading-relaxed line-clamp-2">"{msg.content}"</p>
                        <button
                        onClick={() => navigate(`/view/${msg.daoSlug}/mandate/${msg.mandateId}`)}
                        className="w-full font-mono text-[10px] uppercase tracking-wider text-center py-1.5 border border-border rounded text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors">
                        
                          View in Chatroom →
                        </button>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </ScrollArea>
      </main>

      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>);

}