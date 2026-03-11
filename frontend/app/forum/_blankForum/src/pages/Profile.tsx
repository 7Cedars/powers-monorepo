import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

import { NavigationDropdown } from '@/components/NavigationDropdown';
import { WalletModal } from '@/components/WalletModal';
import { MandateSheet } from '@/components/MandateSheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ExternalLink, Edit2, MessageSquare, Vote, Award, Calendar, Coins, Link2, Check, X, LogOut, Circle, Camera, CheckCircle } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { DAO_CONFIGS, DaoMandate } from '@/data/daoConfig';
import { getOrangeAvatar } from '@/lib/orangeAvatars';

// Mock data for proof-of-concept
const MOCK_DAO_ROLES = [{
  dao: '[DAO NAME]',
  role: '[Role 1]',
  since: 'dd-mm-yyyy'
}, {
  dao: '[DAO NAME]',
  role: '[Role 2]',
  since: 'dd-mm-yyyy'
}, {
  dao: '[DAO NAME]',
  role: '[Role 3]',
  since: 'dd-mm-yyyy'
}];
const MOCK_SUBDAO_ROLES = [{
  subdao: '[SUB-DAO NAME]',
  role: '[Role 4]',
  since: 'dd-mm-yyyy'
}, {
  subdao: '[SUB-DAO NAME]',
  role: '[Role 5]',
  since: 'dd-mm-yyyy'
}];
const MOCK_TOP_MESSAGES = [{
  id: '1',
  content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
  upvotes: 47,
  dao: 'DAO #0',
  daoSlug: 'primary-dao',
  mandateId: 'p16'
}, {
  id: '2',
  content: 'Sed do eiusmod tempor incididunt ut labore et dolore...',
  upvotes: 32,
  dao: 'DAO #0',
  daoSlug: 'primary-dao',
  mandateId: 'p17'
}, {
  id: '3',
  content: 'Ut enim ad minim veniam, quis nostrud exercitation.',
  upvotes: 28,
  dao: 'DAO #1',
  daoSlug: 'sub-dao-1',
  mandateId: 'd1'
}];
const MOCK_PROPOSALS = [{
  id: 'PIP-42',
  title: 'Treasury Diversification Strategy',
  status: 'Passed',
  role: 'Author'
}, {
  id: 'PIP-38',
  title: 'Governance Token Distribution',
  status: 'Active',
  role: 'Co-author'
}, {
  id: 'PIP-31',
  title: 'Community Grants Program',
  status: 'Passed',
  role: 'Role 1'
}];
// Gather mandates from all DAOs for the profile
const PROFILE_MANDATES = DAO_CONFIGS.flatMap((dao) =>
dao.mandates.filter((m) => m.active).map((m) => ({ ...m, daoName: dao.name }))
);
const MOCK_SBTS = [{
  name: 'OG Member',
  description: 'Early adopter badge',
  image: '🏆'
}, {
  name: 'Verified Builder',
  description: 'Contributed to core protocol',
  image: '🔧'
}, {
  name: 'Governance Expert',
  description: '50+ proposal votes',
  image: '⚖️'
}];
const MOCK_POAPS = [{
  name: 'ETHDenver 2024',
  date: '2024-02-29',
  image: '🎿'
}, {
  name: 'The Cultural Stewardship DAO Launch',
  date: '2024-01-15',
  image: '🚀'
}, {
  name: 'Governance Summit',
  date: '2024-03-20',
  image: '🏛️'
}];
const MOCK_ACTIVITY_TOKENS = {
  symbol: '$PRIMARY',
  balance: 12450,
  rank: 'Top 5%'
};
const MOCK_LINKED_ACCOUNTS = [{
  platform: 'ENS',
  handle: 'participant.eth',
  url: 'https://ens.domains/',
  verified: true
}];
const MOCK_PROFILE = {
  displayName: '[CUSTOM NAME]',
  bio: 'Add a custom bio text here.'
};
const MOCK_STATS = {
  totalMessages: '#',
  avgMessagesPerWeek: '#',
  daysActive: 142,
  lastActive: '# hours ago'
};
export default function Profile() {
  const {
    isConnected,
    isAnonymous,
    walletAddress,
    ensName,
    disconnect
  } = useWallet();
  const navigate = useNavigate();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [selectedMandate, setSelectedMandate] = useState<DaoMandate | null>(null);
  const [selectedMandateDaoName, setSelectedMandateDaoName] = useState('');

  const isWalletConnected = isConnected && !isAnonymous;

  const handleDisconnect = () => {
    disconnect();
    navigate('/');
  };

  // Profile picture state
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleProfilePictureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setProfilePicture(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  // Editable profile state
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(MOCK_PROFILE.displayName);
  const [bio, setBio] = useState(MOCK_PROFILE.bio);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);
  const [tempBio, setTempBio] = useState(bio);
  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  const displayAddress = walletAddress ? truncateAddress(walletAddress) : '0x0000...0000';
  const handleEditClick = () => {
    setTempDisplayName(displayName);
    setTempBio(bio);
    setIsEditing(true);
  };
  const handleSave = () => {
    if (tempDisplayName.trim()) {
      setDisplayName(tempDisplayName.trim());
      setBio(tempBio.trim());
      setIsEditing(false);
    }
  };
  const handleCancel = () => {
    setTempDisplayName(displayName);
    setTempBio(bio);
    setIsEditing(false);
  };
  return <div className="min-h-screen flex flex-col bg-background scanlines">
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

                  {ensName || displayAddress}
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
      <div className="border-b border-border px-4 py-2 bg-muted/5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <NavigationDropdown currentTitle="PROFILE" />
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {!isWalletConnected ?
      <div className="flex-1 flex flex-col items-center justify-center py-24 space-y-8">
            <p className="font-mono text-sm text-muted-foreground tracking-wider">
              To view your profile, please connect a wallet.
            </p>
            <button onClick={() => setWalletModalOpen(true)} className="terminal-btn min-w-[220px]">
              [ CONNECT WALLET ]
            </button>
          </div> :

      <ScrollArea className="h-full">
          <div className="space-y-8">
            
            {/* Profile Header */}
            <section className="border border-border p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* Profile Picture */}
                <div className="relative shrink-0 self-start">
                  <Avatar className="h-20 w-20 border border-border cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <AvatarImage src={profilePicture || getOrangeAvatar(walletAddress || 'default')} alt="Profile picture" />
                    <AvatarFallback className="bg-muted/30">
                      <img src={getOrangeAvatar(walletAddress || 'default')} alt="avatar" className="h-full w-full object-cover" />
                    </AvatarFallback>
                  </Avatar>
                  <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-background border border-border rounded-full p-1 hover:bg-muted/30 transition-colors"
                  title="Change profile picture">
                  
                    <Edit2 className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  className="hidden" />
                
                </div>
                <div className="space-y-2 flex-1">
                  {isEditing ? <>
                      <div className="flex items-center gap-3">
                        <input type="text" value={tempDisplayName} onChange={(e) => setTempDisplayName(e.target.value)} maxLength={50} className="font-mono text-sm text-foreground text-glow bg-transparent border border-border px-2 py-1 outline-none focus:border-foreground uppercase tracking-wider" placeholder="Display name" />
                        <button onClick={handleSave} className="text-foreground hover:text-glow transition-colors" title="Save">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={handleCancel} className="text-muted-foreground hover:text-foreground transition-colors" title="Cancel">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="font-mono text-sm text-foreground">{ensName || displayAddress}</p>
                      <textarea value={tempBio} onChange={(e) => setTempBio(e.target.value)} maxLength={200} rows={3} className="font-mono text-xs text-muted-foreground bg-transparent border border-border px-2 py-1 outline-none focus:border-foreground w-full max-w-lg resize-none" placeholder="Your bio..." />
                    </> : <>
                      <div className="flex items-center gap-3">
                        <h2 className="font-mono text-base text-foreground text-glow uppercase tracking-wider">
                           {displayName}
                         </h2>
                        <button onClick={handleEditClick} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit profile">
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      <p className="font-mono text-xs text-muted-foreground max-w-lg">{bio}</p>
                      <p className="font-mono text-xs flex items-center gap-1.5">
                        <span className="text-muted-foreground">ZKPassport Status:</span>
                        <span className="text-green-500">Verified</span>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      </p>
                      <div className="flex flex-wrap items-center gap-3 mt-2">
                        {MOCK_LINKED_ACCOUNTS.map((account, i) =>
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
                    </>}
                </div>
              </div>
            </section>

            {/* Activity Stats */}
            <section className="border border-border p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono text-center">
                <div className="space-y-1">
                  <p className="text-sm text-foreground text-glow">{MOCK_STATS.lastActive}</p>
                  <p className="text-muted-foreground uppercase tracking-wider text-sm">Last Active</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-foreground text-glow">{MOCK_STATS.totalMessages}</p>
                  <p className="text-muted-foreground uppercase tracking-wider text-sm">Messages</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-foreground text-glow">{MOCK_STATS.avgMessagesPerWeek}</p>
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
                
                {/* DAO & Sub-DAO Roles */}
                <div className="border border-border space-y-3">
                  <h4 className="font-mono text-foreground flex items-center gap-2 uppercase tracking-wider text-sm px-4 py-3 border-b border-border bg-muted/50">
                    <Award className="h-4 w-4" /> DAO Roles
                  </h4>
                  <div className="space-y-2 p-4">
                    {MOCK_DAO_ROLES.map((role, i) => <div key={i} className="font-mono text-xs text-muted-foreground flex justify-between">
                        <span><span className="text-foreground">{role.role}</span> @ {role.dao}</span>
                        <span>since {role.since}</span>
                      </div>)}
                    {MOCK_SUBDAO_ROLES.map((role, i) => <div key={i} className="font-mono text-xs text-muted-foreground flex justify-between">
                        <span><span className="text-foreground">{role.role}</span> @ {role.subdao}</span>
                        <span>since {role.since}</span>
                      </div>)}
                  </div>
                </div>


                {/* Proposals */}

                {/* Top Messages */}
                <div className="border border-border space-y-4">
                  <h4 className="font-mono text-foreground flex items-center gap-2 uppercase tracking-wider text-sm px-4 py-3 border-b border-border bg-muted/50">
                    <MessageSquare className="h-4 w-4" /> Top Upvoted Messages
                  </h4>
                  <div className="space-y-3 p-4">
                    {MOCK_TOP_MESSAGES.map((msg, index) =>
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
      }
      </main>

      
      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} redirectTo="/profile" />
      <MandateSheet
      mandate={selectedMandate}
      daoName={selectedMandateDaoName}
      isWalletConnected={isWalletConnected}
      onClose={() => setSelectedMandate(null)} />

    </div>;
}