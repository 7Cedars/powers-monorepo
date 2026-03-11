import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '@/contexts/WalletContext';
import { WalletModal } from '@/components/WalletModal';

import { ThemeToggle } from '@/components/ThemeToggle';

function useTypewriter(text: string) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    let i = 0;
    const type = () => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
        setTimeout(type, 40 + Math.random() * 160);
      }
    };
    const initial = setTimeout(type, 500);
    return () => clearTimeout(initial);
  }, [text]);
  return displayed;
}

export default function Landing() {
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const {
    enterAnonymous
  } = useWallet();
  const navigate = useNavigate();
  const welcomeText = useTypewriter('> welcome');
  const handleAnonymousView = () => {
    enterAnonymous();
    navigate('/all-daos');
  };
  return <div className="min-h-screen flex flex-col bg-background scanlines">
      {/* Header */}
      <header className="border-b border-border px-3 sm:px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <a href="/dao-info" className="font-mono text-base sm:text-lg text-foreground tracking-wider whitespace-nowrap hover:text-foreground/80 transition-colors">
            [DAO NAME]
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-12">
          {/* Main terminal text with blinking cursor */}
          <h1 className="font-mono text-foreground text-glow flicker cursor-blink tracking-wider text-2xl">{welcomeText}</h1>

          {/* Action buttons */}
          <div className="flex-col items-center gap-4 flex sm:flex-col border-0">
            <button onClick={() => setWalletModalOpen(true)} className="terminal-btn min-w-[220px] flicker-lamp">
              [ CONNECT WALLET ]
            </button>
            
            <button onClick={handleAnonymousView} className="terminal-btn min-w-[220px] flicker-lamp">
              [ VIEW ONLY ]
            </button>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-4 px-4">
        <p className="font-mono text-xs text-center tracking-wider text-orange-500">
          This DAO Portal is powered by Powers Protocol.
        </p>
      </footer>

      <WalletModal open={walletModalOpen} onOpenChange={setWalletModalOpen} redirectTo="/all-daos" />
    </div>;
}