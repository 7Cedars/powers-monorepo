'use client'
 import { useState  } from 'react'; 
 import { usePowersStore } from "@/context/store";  
 import { DaoSummaryBox } from '@/app/forum/_components/DaoSummaryBox';
 import { ActivityOverview } from './ActivityOverview';
 import { identifyFlows } from '@/utils/identifyFlows';

 export default function DaoView() {
    const powers = usePowersStore();

   if (!powers.name) {
     return (
       <div className="min-h-screen flex items-center justify-center bg-background font-mono text-muted-foreground">
         No Powers DAO found at this address and chain. Please check the URL or add this DAO to your saved list.
       </div>);
   }
 
   return (
        <div className="min-h-full min-w-full flex flex-col bg-background scanlines">
        {/* Main Content */}
        <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-2 sm:px-4 py-4 gap-4 overflow-hidden">
        
            {/* DAO Summary - full width top */}
            <DaoSummaryBox powers = {powers} alignment='row'/> 

            {/* THE ACTIVITY OF THE ORG - Unified mandates + actions */}
            <ActivityOverview powers={powers} />

            {/* Roles */}
            {/* Removed for now, can add this later again.  */}


            {/* Treasury */}
            {/* Removed for now, can add this later again.  */}
 
       </main> 
     </div>);
 
 }