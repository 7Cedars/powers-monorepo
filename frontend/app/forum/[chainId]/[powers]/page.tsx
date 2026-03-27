'use client'
 import { useState, useEffect } from 'react'; 
 import { usePowersStore, useStatusStore } from "@/context/store";  
 import { OrgSummaryBox } from '@/components/OrgSummaryBox';
 import { ActivityOverview } from './ActivityOverview';
 import { identifyFlows } from '@/utils/identifyFlows';
 import { usePowers } from '@/hooks/usePowers';
 import { useParams } from 'next/navigation';
 import { ArrowPathIcon } from '@heroicons/react/24/outline';
 import { useErrorStore } from '@/context/store';
import { parseChainId } from '@/utils/parsers';
import { CommunicationChannels } from '@/context/types';
import { MetadataLinks } from '@/components/MetadataLinks';

 export default function OverviewPage() {
    const powers = usePowersStore();
    const statusPowers = useStatusStore();
    const { fetchPowers } = usePowers();
    const { powers: powersAddress, chainId } = useParams<{ powers: `0x${string}`, chainId: string }>();
    const [fetchAttempted, setFetchAttempted] = useState(false);
    const error = useErrorStore((state) => state.error)

    console.log ("ERROR: ", error)

    useEffect(() => {
      console.log("useEffect triggered with powersAddress:", powersAddress, "chainId:", chainId);
      if (powers.contractAddress == undefined || powers.contractAddress == `0x0` || powers.contractAddress != powersAddress) {
        fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId));
      }
    }, [powersAddress, chainId])

    const handleFetchPowers = async () => {
      if (powersAddress && chainId) {
        setFetchAttempted(true);
        await fetchPowers(powersAddress as `0x${string}`, parseChainId(chainId));
      }
    };

   if (!powers.name) {
     return (
       <div className="flex-1 flex flex-col bg-background scanlines font-mono items-center justify-center p-4">
         <div className="max-w-md w-full border border-border bg-background">
           <div className="px-4 py-2 border-b border-border bg-muted/50">
             <span className="text-muted-foreground uppercase tracking-wider text-sm">FETCH POWERS</span>
           </div>
           <div className="p-6 flex flex-col items-center gap-4">
             {!fetchAttempted || statusPowers.status === "pending" ? (
               <>
                 <p className="text-muted-foreground text-center text-sm">
                   Powers has not been loaded yet. If it does not load automatically within one minute, click below to fetch the instance and enter the organisation.
                 </p>
                 <button
                   onClick={handleFetchPowers}
                   disabled={statusPowers.status === "pending"}
                   className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   <ArrowPathIcon 
                     className={`w-4 h-4 ${statusPowers.status === "pending" ? 'animate-spin' : ''}`}
                   />
                   <span className="text-sm uppercase tracking-wider">
                     {statusPowers.status === "pending" ? "FETCHING..." : "ENTER POWERS"}
                   </span>
                 </button>
               </>
             ) : (
               <p className="text-muted-foreground text-center text-sm">
                 No Powers organisation found at this address and chain. Please check the URL or add this organisation to your saved list.
               </p>
             )}
           </div>
         </div>
       </div>
     );
   }
 
   return (
        <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full overflow-y-auto px-2 sm:px-4 py-4 gap-4 min-h-0">
        
            {/* DAO Summary - full width top */}
            <OrgSummaryBox powers={powers} alignment='row' showHeader={false} /> 

            <MetadataLinks 
                      website={powers?.metadatas?.website}
                      codeOfConduct={powers?.metadatas?.codeOfConduct}
                      disputeResolution={powers?.metadatas?.disputeResolution}
                      communicationChannels={powers?.metadatas?.communicationChannels as CommunicationChannels}
                      parentContracts={powers?.metadatas?.parentContracts}
                      childContracts={powers?.metadatas?.childContracts}
                      chainId={powers?.chainId}
                      isEditorView={false}
                    />

            {/* THE ACTIVITY OF THE ORG - Unified mandates + actions */}
            <ActivityOverview powers={powers} />

            {/* Roles */}
            {/* Removed for now, can add this later again.  */}


            {/* Treasury */}
            {/* Removed for now, can add this later again.  */}
 
       </main>
   )
 
 }