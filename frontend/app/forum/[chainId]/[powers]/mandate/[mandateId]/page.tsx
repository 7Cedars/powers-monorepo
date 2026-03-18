'use client'
 
import { useState } from 'react'; 
import { PlusIcon } from "@heroicons/react/24/outline";
import { usePowersStore } from '@/context/store';
import { useParams } from 'next/dist/client/components/navigation';
import { Mandate } from '@/context/types';
import { bigintToRole } from '@/utils/bigintTo';
import { NewActionDialog } from './NewActionDialog';
import { Chatroom } from '@/components/Chatroom';
import { useWallets } from '@privy-io/react-auth';
import { useReadContract } from 'wagmi';
import { powersAbi } from '@/context/abi';

export default function MandatePage() {
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const powers = usePowersStore();
  const { chainId, powers: powersAddress, mandateId } = useParams<{ chainId: string; powers: string; mandateId: string }>();
  const mandate: Mandate | undefined =  powers?.mandates?.find(m => m.index.toString() === mandateId);
  const numberOfRoleMembers = mandate?.conditions?.allowedRole ? powers?.roles?.find(r => r.roleId.toString() === mandate?.conditions?.allowedRole.toString())?.amountHolders : 0;
  
  // Get wallet address
  const { wallets, ready: walletsReady } = useWallets();
  const walletAddress = walletsReady && wallets[0] ? wallets[0].address : undefined;
  
  // Check if user has the required role
  const { data: hasRoleSinceData } = useReadContract({
    address: powersAddress as `0x${string}`,
    abi: powersAbi,
    functionName: 'hasRoleSince',
    args: walletAddress && mandate?.conditions?.allowedRole 
      ? [walletAddress as `0x${string}`, BigInt(mandate.conditions.allowedRole)]
      : undefined
  });

  console.log("@MandatePage: ", {walletAddress, hasRoleSinceData, numberOfRoleMembers})
  
  // PUBLIC_ROLE is type(uint256).max - everyone has this role by default
  const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  const allowedRole = mandate?.conditions?.allowedRole ? BigInt(mandate.conditions.allowedRole) : BigInt(0);
  
  // User has role if hasRoleSince returns non-zero value OR if the allowed role is PUBLIC_ROLE
  const hasRequiredRole = allowedRole === PUBLIC_ROLE || (hasRoleSinceData ? Number(hasRoleSinceData) > 0 : false);
   

  return (
    <div className="flex-1 flex flex-col bg-background scanlines font-mono">
      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-2 border-b border-border bg-muted/50">
            <div>
              <h3 className="text-foreground text-base"> {mandate?.nameDescription ? mandate.nameDescription.split(':')[0] || '' : ''}</h3>
              <p className="text-muted-foreground text-sm">Mandate #{mandate?.index}</p>
            </div>
            <span className="text-xs text-right text-muted-foreground"> 
              <p> {bigintToRole(BigInt(mandate?.conditions?.allowedRole?.toString() || '0'), powers)} </p>
            </span>
          </div>

          {/* More Details + Start Action Row */}
          <div className="border-b border-border flex flex-col sm:flex-row">
            {/* More Details - Left */}
            <div className="flex-1 p-4 overflow-y-auto sm:border-r border-b sm:border-b-0 border-border" style={{ maxHeight: '180px' }}>
              {/* <div className="flex items-center gap-2 mb-3"> */}
                {/* <FileText className="h-3 w-3 text-muted-foreground" /> */}
                {/* <h4 className="text-xs text-muted-foreground uppercase tracking-wider">More Details</h4> */}
              {/* </div> */}
              <p className="px-2 text-sm text-muted-foreground leading-relaxed">
                {mandate?.nameDescription ? mandate.nameDescription.split(':')[1] || '' : ''}
              </p>
              
            </div>
            {/* Start a New Action - Right */}
            <div className="p-4 flex items-center justify-center sm:w-80 shrink-0">
              <button
                onClick={() => setActionDialogOpen(true)}
                disabled={!hasRequiredRole}
                className={`flex items-center gap-2 px-2 px-6 py-3 transition-opacity ${
                  hasRequiredRole 
                    ? 'cursor-pointer bg-primary text-primary-foreground hover:opacity-80' 
                    : 'cursor-not-allowed bg-muted text-muted-foreground opacity-50'
                }`}
              >
                <PlusIcon className="h-4 w-4" />
                <h4 className="text-sm uppercase tracking-wider">Start a New Action</h4>
              </button>
            </div>
          </div>

          <Chatroom chatroomType="Mandate" hasRole={hasRequiredRole} />
        </div>
      </main>

      {/* New Action Dialog */}
      {mandate && (
        <NewActionDialog
          open={actionDialogOpen}
          onOpenChange={setActionDialogOpen}
          mandate={mandate}
        />
      )}
    </div>
  );

}