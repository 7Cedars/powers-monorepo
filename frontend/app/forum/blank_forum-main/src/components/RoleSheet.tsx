import { useNavigate } from 'react-router-dom';
import { getOrangeAvatar } from '@/lib/orangeAvatars';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Users } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RoleMember {
  address: string;
  ensName?: string;
}

interface RoleSheetProps {
  roleName: string | null;
  daoName: string;
  onClose: () => void;
}

const DEMO_MEMBERS: Record<string, RoleMember[]> = {
  'Role 1': [
  { address: '0x1a2b3c4d5e6f7890abcdef1234567890abcdef12', ensName: 'alice.eth' },
  { address: '0x2b3c4d5e6f7890abcdef1234567890abcdef1234' },
  { address: '0x3c4d5e6f7890abcdef1234567890abcdef123456', ensName: 'bob.eth' }],

  'Role 2': [
  { address: '0x4d5e6f7890abcdef1234567890abcdef12345678', ensName: 'charlie.eth' },
  { address: '0x5e6f7890abcdef1234567890abcdef1234567890' }],

  'Role 3': [
  { address: '0x6f7890abcdef1234567890abcdef123456789012', ensName: 'dave.eth' },
  { address: '0x7890abcdef1234567890abcdef12345678901234' },
  { address: '0x890abcdef1234567890abcdef1234567890123456', ensName: 'eve.eth' },
  { address: '0x90abcdef1234567890abcdef12345678901234567' }],

  'Role 4': [
  { address: '0xabcdef1234567890abcdef1234567890abcdef12', ensName: 'frank.eth' }],

  'Role 5': [
  { address: '0xbcdef1234567890abcdef1234567890abcdef1234' },
  { address: '0xcdef1234567890abcdef1234567890abcdef123456', ensName: 'grace.eth' },
  { address: '0xdef1234567890abcdef1234567890abcdef12345678' }],

  'Moderator': [
  { address: '0xKaren0000000000000000000000000000000001', ensName: 'karen.eth' }],
};

const truncateAddress = (address: string) =>
`${address.slice(0, 6)}...${address.slice(-4)}`;

export function RoleSheet({ roleName, daoName, onClose }: RoleSheetProps) {
  const navigate = useNavigate();
  const members = roleName ? DEMO_MEMBERS[roleName] || [] : [];

  return (
    <Sheet open={!!roleName} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[85vh] bg-background border-t border-border p-0 font-mono">
        
        {roleName &&
        <div className="h-full flex flex-col animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-border">
              <div>
                <p className="text-muted-foreground text-xs">{daoName}</p>
                <h3 className="text-foreground uppercase text-base">{roleName}</h3>
              </div>
            </div>

            {/* Summary */}
            <div className="px-6 py-3 border-b border-border">
              <h4 className="text-muted-foreground uppercase tracking-wider mb-2 text-sm">What does this role do?</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
            </div>

            {/* Members list */}
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/10">
                <Users className="h-3 w-3 text-muted-foreground" />
                <h4 className="text-muted-foreground uppercase tracking-wider text-sm">
                  Members ({members.length})
                </h4>
              </div>
              <ScrollArea className="flex-1">
                <div className="px-6 py-2 space-y-1">
                  {members.map((member, index) => {
                  return (
                    <div
                      key={member.address}
                      className="flex items-center gap-3 py-2 px-3 rounded hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => navigate(`/user/${member.ensName || member.address}`)}>
                      
                      <img src={getOrangeAvatar(member.address || index)} alt="avatar" className="h-8 w-8 rounded-full border border-border object-cover shrink-0" />
                      <div className="flex flex-col">
                        {member.ensName &&
                        <span className="text-xs text-foreground hover:text-primary hover:underline underline-offset-2 transition-colors">{member.ensName}</span>
                        }
                        <span className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          {truncateAddress(member.address)}
                        </span>
                      </div>
                    </div>);

                })}
                </div>
              </ScrollArea>
            </div>

            {/* Footer hint */}
            <div className="px-6 py-3 border-t border-border flex justify-center text-xs text-muted-foreground">
              <span>Press ESC or click outside to close</span>
            </div>
          </div>
        }
      </SheetContent>
    </Sheet>);

}