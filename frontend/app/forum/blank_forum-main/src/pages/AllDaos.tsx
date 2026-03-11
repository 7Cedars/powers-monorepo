import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

import { NavigationDropdown } from '@/components/NavigationDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MandateSheet } from '@/components/MandateSheet';
import { LogOut, Circle, X } from 'lucide-react';
import { WalletModal } from '@/components/WalletModal';
import { DAO_CONFIGS, DaoMandate } from '@/data/daoConfig';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle } from
'@/components/ui/alert-dialog';

const PROFILE_MANDATES = DAO_CONFIGS.flatMap((dao) =>
dao.mandates.filter((m) => m.active).map((m) => ({ ...m, daoName: dao.name }))
);

export default function AllDaos() {
  const navigate = useNavigate();
  const { isConnected, isAnonymous, walletAddress, ensName, disconnect } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [selectedMandate, setSelectedMandate] = useState<(DaoMandate & {daoName: string;}) | null>(null);
  const [selectedMandateDaoName, setSelectedMandateDaoName] = useState('');
  const [hiddenDaos, setHiddenDaos] = useState<string[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines">
      <header className="border-b border-border px-3 sm:px-4 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <a href="/dao-info" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">[DAO NAME]</a>
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

      <div className="border-b border-border px-4 py-2 bg-muted/5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <NavigationDropdown />
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <h1 className="font-mono text-foreground tracking-wider mb-2 text-center uppercase text-lg">ALL DAOs</h1>
        <p className="font-mono text-xs text-muted-foreground text-center mb-6">Here is a live overview of all DAOs in the [DAO NAME] ecosystem.</p>

        {/* DAO Summary Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DAO_CONFIGS.filter((dao) => !hiddenDaos.includes(dao.id)).map((dao) =>
          <div
            key={dao.id}
            className="border border-border cursor-pointer hover:bg-muted/10 transition-colors relative"
            onClick={() => navigate(`/view/${dao.slug}`)}>
            
              <div className="px-4 py-2 border-b border-border bg-muted/10 flex items-center justify-between">
                <span className="font-mono text-muted-foreground uppercase tracking-wider text-base">{dao.name}</span>
                <button
                onClick={(e) => {
                  e.stopPropagation();
                  setArchiveTarget(dao.id);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors">
                
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="px-4 py-3 space-y-3">
                <p className="font-mono text-xs text-muted-foreground leading-relaxed">
                  [CUSTOM DAO SUMMARY TEXT]
                </p>
                <div className="grid grid-cols-3 gap-x-6 gap-y-2">
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
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Active</span>
                    <p className="font-mono text-sm text-foreground">0</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">Treasury</span>
                    <p className="font-mono text-sm text-foreground">0</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <AlertDialog open={!!archiveTarget} onOpenChange={(open) => !open && setArchiveTarget(null)}>
          <AlertDialogContent className="font-mono">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-mono text-sm tracking-wider">ARCHIVE DAO</AlertDialogTitle>
              <AlertDialogDescription className="font-mono text-xs leading-relaxed">
                Are you sure you want to archive this DAO? To add it again, you will need to visit [ADDRESS].
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="font-mono text-xs">Go back</AlertDialogCancel>
              <AlertDialogAction
                className="font-mono text-xs"
                onClick={() => {
                  if (archiveTarget) {
                    setHiddenDaos((prev) => [...prev, archiveTarget]);
                  }
                  setArchiveTarget(null);
                }}>
                
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>

      
      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />

      {selectedMandate &&
      <MandateSheet
        mandate={selectedMandate}
        daoName={selectedMandateDaoName}
        isWalletConnected={isWalletConnected}
        onClose={() => setSelectedMandate(null)}
        onSwitchMandate={(m) => {
          setSelectedMandate({ ...m, daoName: selectedMandateDaoName });
        }} />

      }
    </div>);

}