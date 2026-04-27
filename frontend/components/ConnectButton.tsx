"use client"

import { usePrivy, useCreateWallet } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth";
import { 
  FingerPrintIcon,
  PlusCircleIcon,
  WalletIcon
} from '@heroicons/react/24/outline'; 
import { useState } from "react";

export const ConnectButton = () => {
  const {ready: walletsReady, wallets} = useWallets();
  const {ready, authenticated, login, logout, connectWallet} = usePrivy();
  const {createWallet} = useCreateWallet();
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateEmbeddedWallet = async () => {
    setIsCreating(true);
    try {
      await createWallet();
    } catch (error) {
      console.error('Failed to create embedded wallet:', error);
    } finally {
      setIsCreating(false);
    }
  };

  //NB see: 
  // https://github.com/privy-io/wagmi-demo/blob/main/app/page.tsx
  // and 
  //https://demo.privy.io/
  // watch out, if you try anything original. You'll suffer. 

  return (
    <> 
    {
    ready && !authenticated ?  
      <button
        className={`w-fit h-full flex flex-row items-center justify-center text-center border-opacity-0 md:border-opacity-100 border border-border hover:border-foreground/50`}  
        onClick={ login }
      >
        <div className={`w-fit h-full flex flex-row items-center justify-center text-center bg-foreground hover:bg-foreground/80 text-background px-3 py-1`}>
            <FingerPrintIcon
              className="h-6 w-6 text-bold md:w-0 md:opacity-0 opacity-100" 
            />
            <div
              className="md:w-fit w-0 opacity-0 md:opacity-100" 
             >
              Connect wallet
            </div>
        </div>
      </button>
    :
    ready && authenticated && walletsReady && !wallets[0] ?
      <div className="flex flex-row gap-1">
        <button
          className={`w-fit h-full flex flex-row items-center justify-center text-center border-opacity-0 md:border-opacity-100 border border-border hover:border-foreground/50`}  
          onClick={ connectWallet }
        >
          <div className={`w-fit h-full flex flex-row items-center justify-center text-center bg-foreground hover:bg-foreground/80 text-background px-3 py-1`}>
              <WalletIcon
                className="h-6 w-6 text-bold md:w-0 md:opacity-0 opacity-100" 
              />
              <div
                className="md:w-fit w-0 opacity-0 md:opacity-100" 
               >
                Connect wallet
              </div>
          </div>
        </button>
        <button
          className={`w-fit h-full flex flex-row items-center justify-center text-center border-opacity-0 md:border-opacity-100 border border-border hover:border-foreground/50 ${isCreating ? 'opacity-50 cursor-not-allowed' : ''}`}  
          onClick={ handleCreateEmbeddedWallet }
          disabled={isCreating}
        >
          <div className={`w-fit h-full flex flex-row items-center justify-center text-center bg-accent hover:bg-accent/80 text-accent-foreground px-3 py-1`}>
              <PlusCircleIcon
                className="h-6 w-6 text-bold md:w-0 md:opacity-0 opacity-100" 
              />
              <div
                className="md:w-fit w-0 opacity-0 md:opacity-100" 
               >
                {isCreating ? 'Creating...' : 'Create wallet'}
              </div>
          </div>
        </button>
      </div>
    :
    ready && authenticated && walletsReady && wallets[0] ?
      <button
          className={`w-fit h-full flex flex-row items-center justify-center text-center border-opacity-0 md:border-opacity-100 border border-border hover:border-foreground/50`}  
          onClick={ logout }
        >
          <div className={`flex flex-row items-center text-center text-muted-foreground md:gap-2 gap-0 w-full h-full md:py-1 px-2 py-0 font-mono`}>
            <div className="md:w-fit w-0 opacity-0 md:opacity-100">
              {`${wallets[0].address.slice(0, 6)}...${wallets[0].address.slice(-6)}`}
            </div>
          </div>
        </button>
    :
    <button
    className={`w-fit h-full flex flex-row items-center justify-center text-center border-opacity-0 md:border-opacity-100 border border-border opacity-50 cursor-not-allowed`}  
    disabled={true}
    onClick={ () => {} }
    >
      <div className={`w-fit h-full flex flex-row items-center justify-center text-center bg-foreground text-background px-3 py-1`}>
          <FingerPrintIcon
            className="h-6 w-6 text-bold md:w-0 md:opacity-0 opacity-100" 
          />
          <div
            className="md:w-fit w-0 opacity-0 md:opacity-100" 
          >
            Loading...
          </div>
      </div>
    </button>
    }
    </>
  )
}