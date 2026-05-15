'use client'

import { UserCircleIcon, DocumentTextIcon, BoltIcon, HandRaisedIcon } from '@heroicons/react/24/outline';
import { Roles } from './Roles';
import { Inbox } from './Inbox';
import { useWallets } from '@privy-io/react-auth';
import { useAddressDisplay } from '@/hooks/useAddressDisplay';
import { useProfileStats } from '@/hooks/useProfileStats';

export default function UserProfile() {
  const { wallets, ready: walletsReady } = useWallets();
  const userAddress = wallets[0]?.address as `0x${string}` | undefined;
  const { displayName, ensName, isLoading: ensLoading } = useAddressDisplay(userAddress);
  const { proposals, executions, votes, isLoadingVotes } = useProfileStats(userAddress);

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines">
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        <div className="space-y-8">

          {/* Profile Header */}
          <section className="border border-border p-6">
            {!walletsReady ? (
              <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm uppercase tracking-wider">
                <UserCircleIcon className="h-8 w-8" />
                <span>···</span>
              </div>
            ) : !userAddress ? (
              <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm uppercase tracking-wider">
                <UserCircleIcon className="h-8 w-8" />
                <span>No wallet connected</span>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-6 w-full">
                {/* Avatar + address */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="h-10 w-10 shrink-0 text-muted-foreground">
                    <UserCircleIcon className="h-full w-full" />
                  </div>
                  <div className="min-w-0">
                    <h2 className={`font-mono text-base text-foreground tracking-wider truncate${ensName ? '' : ' uppercase'}`}>
                      {ensLoading ? '···' : displayName}
                    </h2>
                    {ensName && userAddress && (
                      <p className="font-mono text-xs text-muted-foreground mt-0.5">
                        {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px lg:w-px lg:h-auto bg-border shrink-0" />

                {/* Proposals */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <DocumentTextIcon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm text-foreground uppercase tracking-wider">Proposals</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created</span>
                      <span className="text-foreground font-semibold">{proposals}</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px lg:w-px lg:h-auto bg-border shrink-0" />

                {/* Executions */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <BoltIcon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm text-foreground uppercase tracking-wider">Executions</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Fulfilled</span>
                      <span className="text-foreground font-semibold">{executions}</span>
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px lg:w-px lg:h-auto bg-border shrink-0" />

                {/* Votes */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <HandRaisedIcon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm text-foreground uppercase tracking-wider">Votes</h4>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Cast</span>
                      <span className="text-foreground font-semibold">
                        {isLoadingVotes ? <span className="text-muted-foreground">···</span> : votes}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* On-Chain Section */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              <div className="lg:col-span-1">
                <Roles userAddress={userAddress} />
              </div>

              <div className="lg:col-span-2">
                <Inbox userAddress={userAddress} />
              </div>

            </div>
          </div>

        </div>
      </main>
    </div>
  )
}
