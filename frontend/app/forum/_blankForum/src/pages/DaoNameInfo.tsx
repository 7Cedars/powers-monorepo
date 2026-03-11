import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';

import { ThemeToggle } from '@/components/ThemeToggle';
import { LogOut, Circle } from 'lucide-react';
import { WalletModal } from '@/components/WalletModal';
import { useState } from 'react';

export default function DaoNameInfo() {
  const navigate = useNavigate();
  const { isConnected, isAnonymous, walletAddress, ensName, disconnect } = useWallet();
  const [walletModalOpen, setWalletModalOpen] = useState(false);

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
            <span className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap">
              [DAO NAME]
            </span>
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

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-8">
        <div className="border border-border p-6 text-center space-y-4">
          <h1 className="font-mono text-foreground tracking-wider mb-2 uppercase text-6xl">
            [DAO NAME] 
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            This is an empty information page for [DAO NAME].
          </p>
          <a href="/all-daos" className="inline-block font-mono text-xs border border-border px-4 py-2 text-foreground hover:bg-muted/20 transition-colors">
            GO BACK TO ALL DAOs
          </a>
        </div>
      </main>

      
      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} />
    </div>);

}