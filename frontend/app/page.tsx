// This should become landing page: 
// searchers for deployed Separated Powers Protocols.
// Has search bar.
// also has template DAOs to deploy.  
// Loads names,# mandates, # proposals, # roles, # members, chain. 
// see example: https://www.tally.xyz/explore

"use client";

import { SectionIntro } from "./SectionIntro";
import { SectionDemo } from "./SectionDemo";
import { SectionApplications } from "./SectionApplications";
import { SectionExamples } from "./SectionExamples";
import { Footer } from "../components/Footer";
import { SectionForum } from "./SectionForum";
import { HeroSection } from "./HeroSection";

export default function Page() {          

    console.log("@HomePage, waypoint 0"); 

    return (
        <main className="w-full h-screen flex flex-col overflow-y-auto overflow-x-clip bg-background scanlines">
            <HeroSection />

            <SectionIntro />
            <SectionDemo />
            <SectionApplications />
            <SectionExamples />
            {/* <div className="min-h-screen"><SectionForum /></div> */}
            <Footer />
           
        </main>
    )
}
