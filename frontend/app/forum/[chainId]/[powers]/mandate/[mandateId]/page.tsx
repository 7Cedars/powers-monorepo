'use client'
 
import { useState, useMemo, useEffect } from 'react'; 
import { PlusIcon } from "@heroicons/react/24/outline";
import { usePowersStore } from '@/context/store';
import { useParams, useRouter } from 'next/navigation';
import { Action, Mandate } from '@/context/types';
import { bigintToRole } from '@/utils/bigintTo';
import { NewActionDialog } from './NewActionDialog';
import { Chatroom } from '@/components/Chatroom';
import { useWallets } from '@privy-io/react-auth';
import { useReadContract, useBlockNumber } from 'wagmi';
import { powersAbi } from '@/context/abi';
import { parseChainId } from '@/utils/parsers';
import { calculateVoteTimeRemaining } from '@/public/organisations/helpers';

export default function MandatePage() {
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const router = useRouter();
  const powers = usePowersStore();
  const { chainId, powers: powersAddress, mandateId } = useParams<{ chainId: string; powers: string; mandateId: string }>();
  const mandate: Mandate | undefined = powers?.mandates?.find(m => m.index.toString() === mandateId); 
  const { data: currentBlockNumber } = useBlockNumber({ chainId: parseChainId(chainId) || undefined });

  // Redirect to overview page if powers data is not loaded yet
  useEffect(() => {
    if (!powers || !powers.name || powers.contractAddress === '0x0' || powers.contractAddress === undefined) {
      router.push(`/forum/${chainId}/${powersAddress}`);
    }
  }, [powers, router, chainId, powersAddress]);
  
  // Get wallet address
  const { wallets, ready: walletsReady } = useWallets();
  const walletAddress = walletsReady && wallets[0] ? wallets[0].address : undefined;
  
  // Check if user has the required role
  const { data: hasRoleSinceData } = useReadContract({
    address: powersAddress as `0x${string}`,
    abi: powersAbi,
    functionName: 'hasRoleSince',
    args: walletAddress && mandate?.conditions?.allowedRole !== undefined
      ? [walletAddress as `0x${string}`, BigInt(mandate.conditions.allowedRole)]
      : undefined
  });
  
  // PUBLIC_ROLE is type(uint256).max - everyone has this role by default
  const PUBLIC_ROLE = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
  const allowedRole = mandate?.conditions?.allowedRole !== undefined ? BigInt(mandate.conditions.allowedRole) : BigInt(0);
  
  // User has role if hasRoleSince returns non-zero value OR if the allowed role is PUBLIC_ROLE
  const hasRequiredRole = allowedRole === PUBLIC_ROLE || (hasRoleSinceData ? Number(hasRoleSinceData) > 0 : false);

  // Get sorted actions (up to 25, most recent first)
  const sortedActions = useMemo(() => {
    if (!mandate?.actions || mandate.actions.length === 0) return [];
    
    const sorted = [...mandate.actions].sort((a, b) => {
      const aTime = a.proposedAt && a.requestedAt 
        ? (a.proposedAt > a.requestedAt ? a.proposedAt : a.requestedAt)
        : (a.proposedAt || a.requestedAt || 0n);
      const bTime = b.proposedAt && b.requestedAt 
        ? (b.proposedAt > b.requestedAt ? b.proposedAt : b.requestedAt)
        : (b.proposedAt || b.requestedAt || 0n);
      
      if (aTime > bTime) return -1;
      if (aTime < bTime) return 1;
      return 0;
    });
    
    return sorted.slice(0, 25);
  }, [mandate?.actions]);

  // Compute usage statistics
  const stats = useMemo(() => {
    const actions = mandate?.actions || [];
    const total = actions.length;
    const proposed = actions.filter(a => a.state === 1).length;
    const cancelled = actions.filter(a => a.state === 2).length;
    const active = actions.filter(a => a.state === 3).length;
    const defeated = actions.filter(a => a.state === 4).length;
    const succeeded = actions.filter(a => a.state === 5).length;
    const requested = actions.filter(a => a.state === 6).length;
    const fulfilled = actions.filter(a => a.state === 7).length;
    return { total, proposed, cancelled, active, defeated, succeeded, requested, fulfilled };
  }, [mandate?.actions]);

  // Helper function to get action status
  const getActionStatus = (action: Action): { text: string; color: string; isActive: boolean } => {
    if (action.state === undefined) return { text: 'UNKNOWN', color: 'text-gray-500', isActive: false };
    
    if (action.state === 3 && 
        action.proposedAt && 
        mandate?.conditions?.votingPeriod && 
        currentBlockNumber &&
        chainId) {
      const parsedChainId = parseChainId(chainId);
      if (parsedChainId) {
        const timeRemaining = calculateVoteTimeRemaining(
          action.proposedAt,
          mandate.conditions.votingPeriod,
          currentBlockNumber,
          parsedChainId
        );
        return { text: timeRemaining, color: 'text-green-600', isActive: true };
      }
    }
    
    const stateConfig: Record<number, { text: string; color: string }> = {
      0: { text: 'NON EXISTENT', color: 'text-gray-500' },
      1: { text: 'PROPOSED', color: 'text-blue-600' },
      2: { text: 'CANCELED', color: 'text-gray-500' },
      3: { text: 'ACTIVE', color: 'text-green-600' },
      4: { text: 'DEFEATED', color: 'text-red-600' },
      5: { text: 'SUCCEEDED', color: 'text-green-600' },
      6: { text: 'REQUESTED', color: 'text-yellow-600' },
      7: { text: 'FULFILLED', color: 'text-green-700' }
    };
    
    const config = stateConfig[action.state] || { text: 'UNKNOWN', color: 'text-gray-500' };
    return { ...config, isActive: false };
  };

  return (
    <div className="flex-1 flex flex-col bg-background scanlines font-mono">
      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-4 gap-4 overflow-hidden">
        <div className="flex-1 flex flex-col border border-border overflow-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 sm:py-2 border-b border-border bg-muted/50 gap-4 sm:gap-3">
            <div className="min-w-0 flex-1 text-center sm:text-left w-full">
              <h3 className="text-foreground text-base truncate">#{mandate?.index?.toString()} {mandate?.nameDescription ? mandate.nameDescription.split(':')[0] || '' : ''}</h3>
              <p className="text-muted-foreground text-sm truncate">{mandate?.nameDescription ? mandate.nameDescription.split(':')[1] || '' : ''}</p>
            </div>
            <button
              onClick={() => setActionDialogOpen(true)}
              disabled={!hasRequiredRole}
              className={`flex-shrink-0 flex items-center gap-2 px-6 py-2 text-sm uppercase tracking-wider whitespace-nowrap transition-opacity ${
                hasRequiredRole 
                  ? 'cursor-pointer bg-foreground text-background hover:bg-foreground/80' 
                  : 'cursor-not-allowed bg-muted text-muted-foreground opacity-50'
              }`}
            >
              <PlusIcon className="h-4 w-4" />
              New Action
            </button>
          </div>

          {/* Three Column Section */}
          <div className="border-b border-border">
            <div className="flex flex-col lg:flex-row lg:divide-x divide-border w-full">
              {/* LEFT: Mandate Conditions */}
              <div className="flex-1 min-w-0 border-b lg:border-b-0 border-border p-4 overflow-y-auto" style={{ maxHeight: '280px' }}>
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Conditions</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Role</span>
                    <span className="text-foreground">{bigintToRole(BigInt(mandate?.conditions?.allowedRole?.toString() || '0'), powers)}</span>
                  </div> 
                  {mandate?.conditions?.quorum != null && BigInt(mandate.conditions.quorum) !== 0n && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Quorum</span>
                        <span className="text-foreground">{mandate.conditions.quorum.toString()}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Succeed At</span>
                        <span className="text-foreground">{mandate?.conditions?.succeedAt?.toString() || '0'}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Voting Period</span>
                        <span className="text-foreground">{mandate?.conditions?.votingPeriod?.toString() || '0'} blocks</span>
                      </div>
                    </>
                  )}
                  {mandate?.conditions?.timelock != null && BigInt(mandate.conditions.timelock) !== 0n && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Timelock</span>
                      <span className="text-foreground">{mandate.conditions.timelock.toString()} blocks</span>
                    </div>
                  )}
                  {mandate?.conditions?.throttleExecution != null && BigInt(mandate.conditions.throttleExecution) !== 0n && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Throttle</span>
                      <span className="text-foreground">{mandate.conditions.throttleExecution.toString()} blocks</span>
                    </div>
                  )}
                  {mandate?.conditions?.needFulfilled != null && BigInt(mandate.conditions.needFulfilled) !== 0n && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Need Fulfilled</span>
                      <span className="text-foreground">#{mandate.conditions.needFulfilled.toString()}</span>
                    </div>
                  )}
                  {mandate?.conditions?.needNotFulfilled != null && BigInt(mandate.conditions.needNotFulfilled) !== 0n && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Need Not Fulfilled</span>
                      <span className="text-foreground">#{mandate.conditions.needNotFulfilled.toString()}</span>
                    </div>
                  )} 
                </div>
              </div>

              {/* MIDDLE: Usage Statistics */}
              <div className="flex-1 min-w-0 border-b lg:border-b-0 border-border p-4">
                <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Usage</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Actions</span>
                    <span className="text-foreground font-semibold">{stats.total}</span>
                  </div>
                  {stats.active > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-600">Active</span>
                      <span className="text-green-600">{stats.active}</span>
                    </div>
                  )}
                  {stats.proposed > 0 && (
                    <div className="flex justify-between">
                      <span className="text-blue-600">Proposed</span>
                      <span className="text-blue-600">{stats.proposed}</span>
                    </div>
                  )}
                  {stats.requested > 0 && (
                    <div className="flex justify-between">
                      <span className="text-yellow-600">Requested</span>
                      <span className="text-yellow-600">{stats.requested}</span>
                    </div>
                  )}
                  {stats.succeeded > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-600">Succeeded</span>
                      <span className="text-green-600">{stats.succeeded}</span>
                    </div>
                  )}
                  {stats.fulfilled > 0 && (
                    <div className="flex justify-between">
                      <span className="text-green-700">Fulfilled</span>
                      <span className="text-green-700">{stats.fulfilled}</span>
                    </div>
                  )}
                  {stats.defeated > 0 && (
                    <div className="flex justify-between">
                      <span className="text-red-600">Defeated</span>
                      <span className="text-red-600">{stats.defeated}</span>
                    </div>
                  )}
                  {stats.cancelled > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cancelled</span>
                      <span className="text-gray-500">{stats.cancelled}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: Actions List */}
              <div className="flex-1 min-w-0 p-4 overflow-y-auto" style={{ maxHeight: '280px' }}>
                <h4 className="text-sm text-muted-foreground uppercase tracking-wider mb-3">Recent Actions</h4>
                {sortedActions.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {sortedActions.map((action, idx) => {
                      const status = getActionStatus(action);
                      return (
                        <div key={`action-${action.actionId}-${idx}`} className="flex items-start gap-2">
                          <span
                            className="text-foreground text-sm cursor-pointer hover:text-primary hover:underline transition-colors flex-1 truncate"
                            onClick={() => router.push(`/forum/${chainId}/${powersAddress}/action/${action.actionId}`)}
                          >
                            {action.description || 'No description'}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {status.isActive && (
                              <span className="w-2 h-2 bg-green-500" />
                            )}
                            <span className={`${status.color} text-[10px]`}>
                              {status.text}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-muted-foreground/50 text-xs">No actions yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Chatroom */}
          <Chatroom 
            chatroomType="Mandate" 
            hasRole={hasRequiredRole}
            isPublicRole={allowedRole === PUBLIC_ROLE}
            chainId={chainId}
            powersAddress={powersAddress}
            contextId={mandateId}
            xmtpAgentAddress={powers.metadatas?.xmtpAgentAddress}
          />
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