"use client";

import { ChevronDownIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { DemoFlow } from './DemoFlow';

export function SectionIntro() {

  return (
    <section id="intro" className="w-full flex flex-col items-center gap-4 bg-muted/25 border-t border-border px-4 py-8">
        {/* title  */}
          <section className="w-full flex flex-col justify-center items-center pt-4">
              <div className="w-full flex flex-col justify-center items-center md:text-4xl text-xl font-mono font-bold text-foreground max-w-4xl text-center text-pretty pb-2 uppercase tracking-wider">
                Composable Governance
              </div>
              <div className="w-full flex justify-center items-center md:text-lg text-sm font-mono text-muted-foreground max-w-3xl text-center pt-1">
                Most on-chain organisations run on a single multisig or a monolithic Governor contract. One group holds the keys. Proposals pass or fail in a single vote. There are no checks, no balances, no separation between who proposes, who deliberates, and who executes.
                <br /><br />
                Powers Protocol changes that. Governance is assembled from modular, role-restricted components — mandates — that can be combined into any structure an organisation requires.
              </div>
          </section>

          {/* Interactive flow demo — forced light mode */}
          <section className="relative w-full border border-border overflow-hidden group" style={{ height: '500px', '--background': '0 0% 100%', '--foreground': '240 10% 3.9%', '--muted': '240 8% 82%', '--muted-foreground': '240 3.8% 46.1%', '--border': '240 5.9% 90%' } as React.CSSProperties}>
            <DemoFlow />
            <div className="absolute inset-0 flex items-end justify-center pb-5 pointer-events-none opacity-100 group-hover:opacity-0 transition-opacity duration-500">
              <span className="bg-background/90 border border-border px-5 py-2 font-mono text-xs text-muted-foreground uppercase tracking-wider">
                <span className="hidden sm:inline">Drag to pan · Scroll or pinch to zoom</span>
                <span className="sm:hidden">Touch to pan · Pinch to zoom</span>
              </span>
            </div>
          </section>

          {/* documentation link */}
          <section className="w-full max-w-4xl flex flex-row justify-center items-center py-2">
              <a className="border-pulse flex flex-row items-center gap-2 py-3 px-8 font-mono text-sm sm:text-base text-foreground uppercase tracking-wider border"
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'hsl(var(--muted))')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                    href={`https://powers-docs.vercel.app/welcome`} target="_blank" rel="noopener noreferrer">
                        Read the documentation
                        <ArrowTopRightOnSquareIcon className="w-4 h-4 flex-shrink-0" />
              </a>
          </section>

      {/* arrow down */}
      <div className="flex flex-col align-center justify-end">
        <ChevronDownIcon
            className="w-16 h-16 text-muted-foreground"
        /> 
      </div>

    </section>
  )
}
