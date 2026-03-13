'use client'

import { ChatBubbleLeftIcon, TrophyIcon, LinkIcon, ArrowTopRightOnSquareIcon, UserCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

// Default mock data for fields not in userProfiles.ts
const DEFAULT_STATS = {
  totalMessages: '#',
  avgMessagesPerWeek: '#',
  daysActive: 0,
  lastActive: '—'
};

const DEFAULT_TOP_MESSAGES = [
{ id: '1', content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...', upvotes: 12, dao: 'DAO #0', daoSlug: 'primary-dao', mandateId: '16' },
{ id: '2', content: 'Sed do eiusmod tempor incididunt ut labore et dolore...', upvotes: 8, dao: 'DAO #1', daoSlug: 'sub-dao-1', mandateId: '1' }];


const DEFAULT_LINKED_ACCOUNTS: {platform: string;handle: string;url: string;verified: boolean;}[] = [];


export default function UserProfile() {
    // For now, we here use dummy data. 
    const router = useRouter(); 
 
  // Dummy profile data
  const profile = {
    address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    displayName: 'Governance Enthusiast',
    bio: 'Active member in decentralized governance. Passionate about building better on-chain organizations and voting mechanisms.',
    ensName: 'governance.eth',
    daoRoles: [
      { role: 'Proposer', dao: 'Powers Protocol', since: 'Jan 2024' },
      { role: 'Voter', dao: 'DAO Treasury', since: 'Mar 2024' },
      { role: 'Delegate', dao: 'Community Hub', since: 'Feb 2024' }
    ]
  };

  // Linked accounts data
  const linkedAccounts = profile.ensName
    ? [
        { platform: 'ENS', handle: profile.ensName, url: 'https://ens.domains/', verified: true },
        { platform: 'GitHub', handle: 'governance-dev', url: 'https://github.com', verified: true },
        { platform: 'Twitter', handle: '@dao_builder', url: 'https://twitter.com', verified: false }
      ]
    : DEFAULT_LINKED_ACCOUNTS;

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines">
      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          <div className="space-y-8">

            {/* Profile Header — read-only */}
            <section className="border border-border p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* Avatar */}
                <div className="shrink-0 self-start">
                  <div className = "h-20 w-20">
                    <UserCircleIcon /> 
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  <h2 className="font-mono text-base text-foreground text-glow uppercase tracking-wider">{profile.displayName}</h2>
                  
                  <p className="font-mono text-xs text-muted-foreground max-w-lg">{profile.bio}</p>
                  <p className="font-mono text-xs flex items-center gap-1.5">
                    <span className="text-muted-foreground">ZKPassport Status:</span>
                    <span className="text-green-500">Verified</span>
                    <CheckCircleIcon className="h-3 w-3 text-green-500" />
                  </p>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    {linkedAccounts.map((account, i) =>
                    <a key={i} href={account.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <LinkIcon className="h-3 w-3" />
                        {account.platform}: {account.handle}
                        <ArrowTopRightOnSquareIcon className="h-2.5 w-2.5" />
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
                    <TrophyIcon className="h-4 w-4" /> DAO Roles
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
                    <ChatBubbleLeftIcon className="h-4 w-4" /> Top Upvoted Messages
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
                        onClick={() => router.push(`/view/${msg.daoSlug}/mandate/${msg.mandateId}`)}
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
      </main>

    </div>);

}