// This should become landing page: 
// searchers for deployed Separated Powers Protocols.
// Has search bar.
// also has template DAOs to deploy.  
// Loads names,# mandates, # proposals, # roles, # members, chain. 
// see example: https://www.tally.xyz/explore

"use client";

import React from "react";
import { SectionIntro } from "./SectionIntro";
import { SectionApplications } from "./SectionApplications";
import { SectionExamples } from "./SectionExamples";
import { SectionDeployDemo } from "./SectionDeployDemo";
import { Footer } from "./Footer";

import { 
    ArrowUpRightIcon,
    ChevronDownIcon
  } from '@heroicons/react/24/outline';

export default function Page() {          

    console.log("@HomePage, waypoint 0"); 

    return (
        <main className="w-full min-h-screen flex flex-col overflow-y-auto snap-y snap-mandatory overflow-x-hidden bg-background">
            <section className="w-full min-h-screen flex flex-col justify-center items-center bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 snap-start snap-always">
            
                {/* Title and subtitle */}
                <section className="w-full flex flex-col justify-center items-center p-4 pt-20 pb-8">
                    <div className="w-full flex flex-col gap-2 justify-center items-center text-3xl sm:text-6xl font-mono text-white max-w-4xl text-center text-pretty">
                        Communities thrive with 
                        <b className="uppercase tracking-wider">Powers</b>  
                    </div>
                    <div className="w-full flex justify-center items-center text-pretty text-xl sm:text-2xl py-4 font-mono text-slate-300 max-w-4xl text-center p-4">
                        {/* Separate and distribute power through on-chain institutional governance. */}
                        Trustless institutional governance for on-chain organisations.  
                    </div>
                </section>

                <a className="w-fit h-fit max-w-3xl flex flex-row justify-center items-center text-center py-3 px-12 sm:text-xl text-lg font-mono text-white hover:text-slate-300 border border-slate-600 hover:border-white text-center uppercase tracking-wider transition-colors"
                    href={`https://powers-docs.vercel.app/for-developers/litepaper`} target="_blank" rel="noopener noreferrer">
                        Litepaper 
                </a>

                {/* arrow down */}
                <div className="flex flex-col align-center justify-end pb-8 pt-12"> 
                <ChevronDownIcon
                    className="w-16 h-16 text-slate-400" 
                /> 
                </div>
            </section>

            < SectionIntro /> 
            < SectionApplications /> 
            < SectionExamples /> 
            < SectionDeployDemo />
            < Footer />
           
        </main>
    )
}
