"use client";

import { powersApplications } from "../public/powersApplications";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

export function SectionApplications() { 
  return (
    <main className="w-full min-h-screen flex flex-col justify-start items-center bg-gradient-to-b from-slate-600 via-slate-500 to-slate-400 snap-start snap-always py-12 px-2"
      id="powersApplications"
    >    
      <div className="w-full flex flex-col gap-12 justify-between items-center">
        {/* title & subtitle */}
        <div className="w-full flex flex-col justify-center items-center pt-10">
            <div className="w-full flex flex-col gap-1 justify-center items-center md:text-4xl text-2xl font-mono font-bold text-white max-w-4xl text-center text-pretty pb-2 uppercase tracking-wider">
                Applications
            </div>
            <div className="w-full flex flex-col gap-1 justify-center items-center md:text-xl text-lg text-slate-200 max-w-3xl text-center text-pretty font-mono">
                Move beyond simple token voting and design bespoke governance systems that fit your specific needs.
            </div>
        </div>

        {/* info blocks */}
        <section className="w-full flex flex-wrap gap-6 max-w-6xl justify-center items-stretch overflow-y-auto max-h-[70vh] pb-6">   
              {powersApplications.map((useCase, index) => (
                    <div className="w-80 flex flex-col border border-border bg-background shadow-sm hover:shadow-md transition-shadow duration-200" key={index}>  
                      <div className="w-full font-mono font-bold text-foreground p-4 border-b border-border bg-muted/50 uppercase tracking-wider text-sm">
                          {useCase.title}
                      </div> 
          
                      <div className="w-full flex flex-col justify-start items-start px-6 py-4 gap-3">
                        {
                          useCase.details.map((detail, i) => (
                            <div key={i} className="text-muted-foreground leading-relaxed text-sm font-mono">
                              {detail}
                            </div>
                          ))
                        }
                      </div>
                    </div> 
                )
              )}
        </section>

        {/* arrow down */}
        <div className="flex flex-col align-center justify-center pb-8"> 
          <ChevronDownIcon
            className="w-16 h-16 text-slate-300" 
          /> 
        </div>
      </div>
    </main> 
  )
}
