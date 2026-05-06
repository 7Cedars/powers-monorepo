'use client'

import { ChatBubbleLeftIcon, TrophyIcon, LinkIcon, ArrowTopRightOnSquareIcon, UserCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { useRouter } from 'next/navigation';

export default function UserProfile() {
    // For now, we here use dummy data. 
    const router = useRouter(); 

  return (
    <div className="min-h-screen flex flex-col bg-background scanlines">
      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
          <div className="space-y-8">

            {/* Profile Header — read-only */}
            <section className="border border-border p-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                {/* Avatar */}
                <div className="shrink-0 self-start">
                  <div className = "h-20 w-20">
                    <UserCircleIcon /> 
                  </div>
                </div>
                <div className="space-y-2 flex-1">
                  <h2 className="font-mono text-base text-foreground text-glow uppercase tracking-wider">HERE ADDRESS OR ENS NAME</h2>
                  Add latest activity here: votes, proposals, etc. Fetch from event logs. 
                </div>
              </div>
            </section>    

            {/* On-Chain Section */}
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* DAO Roles */}
                <div className="border border-border space-y-3">
                  <h4 className="font-mono text-foreground flex items-center gap-2 uppercase tracking-wider text-sm px-4 py-3 border-b border-border bg-muted/50">
                    <TrophyIcon className="h-4 w-4" /> DAO Roles
                  </h4>
                  <div className="space-y-2 p-4">
                    Add organisation roles here. This can be fetched separately using hasRoleSince calls to contracts (and their role IDs) that are locally saved. 
                    Use same layout as in the commented text below. 
                    {/* {profile.daoRoles.map((role, i) =>
                    <div key={i} className="font-mono text-xs text-muted-foreground flex justify-between">
                        <span><span className="text-foreground">{role.role}</span> @ {role.dao}</span>
                        <span>since {role.since}</span>
                      </div>
                    )} */}
                  </div>
                </div>

                {/* Inbox */}
                <div className="border border-border space-y-4">
                  <h4 className="font-mono text-foreground flex items-center gap-2 uppercase tracking-wider text-sm px-4 py-3 border-b border-border bg-muted/50">
                    <ChatBubbleLeftIcon className="h-4 w-4" /> Inbox
                  </h4>
                  <div className="space-y-3 p-4">
                    Add events here. Fetched from event logs of orgs saved locally. 
                    Events are active votes + executed actions in relevant orgs.
                  </div>
                </div>

              </div>
            </div>

          </div>
      </main>

    </div>);

}