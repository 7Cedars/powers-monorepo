// This should become landing page: 
// searchers for deployed Separated Powers Protocols.
// Has search bar.
// also has template DAOs to deploy.  
// Loads names,# mandates, # proposals, # roles, # members, chain. 
// see example: https://www.tally.xyz/explore

"use client";

import Image from "next/image";
import { SectionIntro } from "./SectionIntro";
import { SectionApplications } from "./SectionApplications";
import { SectionExamples } from "./SectionExamples";
import { Footer } from "../components/Footer";
import { SectionForum } from "./SectionForum";
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { TypewriterText } from "./TypewriterText";

export default function Page() {          

    console.log("@HomePage, waypoint 0"); 

    return (
        <main className="w-full min-h-screen flex flex-col overflow-y-auto overflow-x-hidden bg-background scanlines">
            <section className="w-full min-h-screen flex flex-col justify-center items-center bg-background">

                {/* Title and subtitle */}
                <section className="w-full flex flex-col justify-center items-center p-4 pt-20 pb-8">
                    <Image
                        src="/logo1_notext.png" width={80} height={80} alt="Powers Protocol"
                        className="mb-6 animate-in fade-in duration-700"
                        style={{ animationFillMode: 'both' }}
                    />
                    <div className="w-full flex flex-col gap-2 justify-center items-center text-3xl sm:text-6xl font-mono text-foreground max-w-4xl text-center text-pretty">
                        <span
                            className="animate-in fade-in slide-in-from-bottom-4 duration-700"
                            style={{ animationDelay: '200ms', animationFillMode: 'both' }}
                        >
                            Communities thrive with
                        </span>
                        <b
                            className="uppercase tracking-wider animate-in fade-in slide-in-from-bottom-6 duration-1000"
                            style={{ animationDelay: '500ms', animationFillMode: 'both' }}
                        >
                            Powers
                        </b>
                    </div>
                    <div
                        className="w-full flex justify-center items-center text-pretty text-xl sm:text-2xl py-4 font-mono text-muted-foreground max-w-4xl text-center p-4 animate-in fade-in duration-700"
                        style={{ animationDelay: '800ms', animationFillMode: 'both' }}
                    >
                        Open source, trustless, modular governance infrastructure for transparent separation of powers.
                    </div>
                    <div className="w-full flex justify-center items-center text-pretty text-lg sm:text-xl py-2 font-mono text-muted-foreground max-w-4xl text-center p-4">
                        <TypewriterText
                            text="Because on-chain organisations deserve more than a multisig."
                            startDelay={1000}
                        />
                    </div>
                </section>

                {/* arrow down */}
                <div
                    className="flex flex-col align-center justify-end pb-8 pt-12 animate-in fade-in duration-700"
                    style={{ animationDelay: '1200ms', animationFillMode: 'both' }}
                >
                <ChevronDownIcon
                    className="w-16 h-16 text-muted-foreground"
                />
                </div>
            </section>

            < SectionIntro /> 
            < SectionApplications /> 
            < SectionExamples />
            < SectionForum />
            < Footer />
           
        </main>
    )
}
