import { useNavigate } from 'react-router-dom';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { getUserProfile } from '@/data/userProfiles';
import { getOrangeAvatar } from '@/lib/orangeAvatars';

interface ChatUserHoverCardProps {
  sender: string;
  address: string;
  children: React.ReactNode;
  profilePath: string | null;
}

export function ChatUserHoverCard({ sender, address, children, profilePath }: ChatUserHoverCardProps) {
  const navigate = useNavigate();
  const knownProfile = getUserProfile(sender) || getUserProfile(address);

  const truncateAddr = (addr: string) =>
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  // Build a fallback profile for unknown users from their address/sender
  const profile = knownProfile || {
    displayName: sender.endsWith('.eth') ? sender.replace('.eth', '') : truncateAddr(address || sender),
    ensName: sender.endsWith('.eth') ? sender : undefined,
    address: address || sender,
    bio: 'DAO member.',
    daoRoles: [] as { dao: string; role: string; since: string }[],
  };


  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side="top"
        align="start"
        className="w-64 p-0 border-border bg-background font-mono"
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-3 py-3 border-b border-border cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => profilePath && navigate(profilePath)}
        >
          <img
            src={getOrangeAvatar(profile.address)}
            alt="avatar"
            className="h-10 w-10 rounded-full border border-border object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="text-xs text-foreground font-bold truncate">{profile.displayName}</p>
            {profile.ensName && (
              <p className="text-[10px] text-primary truncate">{profile.ensName}</p>
            )}
            <p className="text-[10px] text-muted-foreground truncate">{truncateAddr(profile.address)}</p>
          </div>
        </div>

        {/* Bio */}
        <div className="px-3 py-2 border-b border-border">
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{profile.bio}</p>
        </div>

        {/* DAO Roles */}
        {profile.daoRoles.length > 0 && (
          <div className="px-3 py-2">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Roles</p>
            <div className="flex flex-wrap gap-1">
              {profile.daoRoles.map((role, i) => (
                <span
                  key={i}
                  className={`inline-block px-1.5 py-0.5 text-[10px] border border-border ${
                    role.role === 'Moderator'
                      ? 'text-destructive border-destructive/30'
                      : 'text-foreground'
                  }`}
                >
                  {role.role}
                </span>
              ))}
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
