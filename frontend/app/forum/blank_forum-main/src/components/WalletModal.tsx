import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWallet, MOCK_WALLET } from '@/contexts/WalletContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo?: string;
}
export function WalletModal({
  open,
  onOpenChange,
  redirectTo
}: WalletModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<'connect' | 'sign'>('connect');
  const {
    connect
  } = useWallet();
  const navigate = useNavigate();
  const location = useLocation();
  const handleConnect = () => {
    setIsConnecting(true);
    // Simulate connection delay
    setTimeout(() => {
      setIsConnecting(false);
      setStep('sign');
    }, 1500);
  };
  const handleSign = () => {
    setIsConnecting(true);
    // Simulate signing delay
    setTimeout(() => {
      connect(MOCK_WALLET.address, MOCK_WALLET.ens);
      onOpenChange(false);
      setStep('connect');
      setIsConnecting(false);
      const target = redirectTo || location.pathname;
      navigate(target);
    }, 1000);
  };
  const handleClose = (open: boolean) => {
    if (!open) {
      setStep('connect');
      setIsConnecting(false);
    }
    onOpenChange(open);
  };
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };
  return <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground font-mono text-lg tracking-wider">
            {step === 'connect' ? '> CONNECT_WALLET' : '> SIGN_MESSAGE'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {step === 'connect' ? <>
              {/* Mock MetaMask-style UI */}
              <div className="border border-border p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-secondary flex items-center justify-center">
                    <span className="text-xs">🦊</span>
                  </div>
                  <span className="text-sm text-muted-foreground">MetaMask</span>
                </div>
                
                <div className="text-xs text-muted-foreground">
                  <p>Connect to url.org</p>
                  <p className="mt-2">This site would like to:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>View your wallet address</li>
                    <li>Request signatures for verification</li>
                  </ul>
                </div>
              </div>

              <button onClick={handleConnect} disabled={isConnecting} className="terminal-btn w-full disabled:opacity-50 disabled:cursor-not-allowed">
                {isConnecting ? '> CONNECTING...' : '> CONNECT'}
              </button>
            </> : <>
              {/* SIWE Sign Message UI */}
              <div className="border border-border p-4 space-y-4">
                <div className="text-xs text-muted-foreground font-mono">
                  <p className="text-foreground mb-2">Sign-In with Ethereum</p>
                  <p>url.org wants you to sign in with your Ethereum account:</p>
                  <p className="text-foreground mt-2 break-all">{MOCK_WALLET.address}</p>
                  
                  <div className="mt-4 pt-4 border-t border-border">
                    <p>Statement: Welcome to [DAO NAME]. Sign this message to authenticate. By signing in and using the chatrooms, you also agree to our community guidelines which can be read at [www.url.org/communityguidelines].</p>
                    <p className="mt-2">URI: https://url.org</p>
                    <p>Nonce: {Math.random().toString(36).substring(2, 10)}</p>
                    <p>Issued At: {new Date().toISOString()}</p>
                  </div>
                </div>
              </div>

              <div className="text-center text-xs text-muted-foreground">
                <p>Connected as:</p>
                <p className="text-foreground">{MOCK_WALLET.ens || truncateAddress(MOCK_WALLET.address)}</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => handleClose(false)} className="terminal-btn flex-1">
                  {'>'} CANCEL
                </button>
                <button onClick={handleSign} disabled={isConnecting} className="terminal-btn flex-1 disabled:opacity-50 disabled:cursor-not-allowed">
                  {isConnecting ? '> SIGNING...' : '> SIGN'}
                </button>
              </div>
            </>}
        </div>
      </DialogContent>
    </Dialog>;
}