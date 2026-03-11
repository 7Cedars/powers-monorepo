import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

import { NavigationDropdown } from '@/components/NavigationDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MandateSheet } from '@/components/MandateSheet';
import { LogOut, Circle, Vote } from 'lucide-react';
import { WalletModal } from '@/components/WalletModal';
import { DAO_CONFIGS, DaoMandate } from '@/data/daoConfig';

const PROFILE_MANDATES = DAO_CONFIGS.flatMap((dao) =>
  dao.mandates.filter((m) => m.active).map((m) => ({ ...m, daoName: dao.name }))
);

const TICKER_ITEMS = [
{ mandates: '23 + 22', hours: 2 },
{ mandates: '47 + 46', hours: 5 },
{ mandates: '31 + 30', hours: 12 },
{ mandates: '58 + 57', hours: 24 }];


function BreakingNewsRow({ mandates, initialHours, delay }: {mandates: string;initialHours: number;delay: number;}) {
  const [timeLeft, setTimeLeft] = useState(initialHours * 60 * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev > 0 ? prev - 1 : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor(timeLeft % 3600 / 60);
  const seconds = timeLeft % 60;
  const countdown = `${hours}H ${String(minutes).padStart(2, '0')}M`;

  return (
    <div className="border border-destructive/50 bg-destructive/5 overflow-hidden">
      <div className="flex items-center">
        <span className="bg-destructive text-destructive-foreground font-mono text-xs px-3 py-2 shrink-0 tracking-wider">
          VOTE NOW!
        </span>
        <div className="overflow-hidden flex-1">
          <p
            className="font-mono text-xs text-foreground whitespace-nowrap py-2 px-4">

            VOTING FOR MANDATES {mandates} ENDING IN <span className="text-destructive font-bold">{countdown}</span>
          </p>
        </div>
      </div>
    </div>);

}

function BreakingNewsTicker() {
  return (
    <div className="mb-6 space-y-1">
      {TICKER_ITEMS.map((item, i) =>
      <BreakingNewsRow key={i} mandates={item.mandates} initialHours={item.hours} delay={i * 2} />
      )}
    </div>);

}

export default function DaoInfo() {
  const navigate = useNavigate();
  const { isConnected, isAnonymous, walletAddress, ensName, disconnect } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [selectedMandate, setSelectedMandate] = useState<(DaoMandate & { daoName: string }) | null>(null);
  const [selectedMandateDaoName, setSelectedMandateDaoName] = useState('');

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
            <a
              className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors"
              href="/dao-info">
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
      <div className="border-b border-border px-4 py-2 bg-muted/5">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <NavigationDropdown />
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="border border-border p-6 text-center">
          <h1 className="font-mono text-base text-foreground tracking-wider mb-2 uppercase">LIVE INFORMATION</h1>
          <p className="font-mono text-xs text-muted-foreground mb-6">This page shows the live stats for all DAOs in the [DAO NAME] ecosystem.</p>
          
          {/* Breaking News Ticker */}
          <BreakingNewsTicker />

        </div>

        {/* My Active Mandates */}
        <div className="border border-border p-4 space-y-3 mt-6">
          <h4 className="font-mono text-xs text-foreground flex items-center gap-2 uppercase tracking-wider">
            <Vote className="h-4 w-4" /> My Active Mandates
          </h4>
          <p className="font-mono text-xs text-muted-foreground">The following mandates require your attention:</p>
          <div className="space-y-2">
            {PROFILE_MANDATES.map((mandate) => (
              <button
                key={mandate.id}
                onClick={() => {
                  setSelectedMandate(mandate);
                  setSelectedMandateDaoName(mandate.daoName);
                }}
                className="w-full font-mono text-xs text-muted-foreground flex justify-between items-center hover:text-foreground hover:bg-muted/20 px-2 py-1.5 -mx-2 rounded transition-colors text-left"
              >
                <span className="flex items-center gap-2">
                  <Circle className={`h-2 w-2 ${mandate.active ? 'fill-green-500 text-green-500' : 'fill-muted-foreground/40 text-muted-foreground/40'}`} />
                  <span className="text-foreground">{mandate.name}</span>
                  <span className="text-muted-foreground/60">— {mandate.daoName}</span>
                </span>
                <span className={mandate.active ? 'text-green-500' : ''}>[{mandate.active ? 'Active' : 'Inactive'}]</span>
              </button>
            ))}
          </div>
        </div>

      </main>

      
      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />

      {selectedMandate && (
        <MandateSheet
          mandate={selectedMandate}
          daoName={selectedMandateDaoName}
          isWalletConnected={isWalletConnected}
          onClose={() => setSelectedMandate(null)}
          onSwitchMandate={(m) => {
            setSelectedMandate({ ...m, daoName: selectedMandateDaoName });
          }}
        />
      )}
    </div>);

}