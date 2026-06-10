"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { DemoFlow } from './DemoFlow';

export function SectionDemo() {

  return (
    <section id="demo" className="w-full h-screen flex flex-col items-center gap-4 bg-muted/25 border-t border-border px-4 py-8">

      {/* Interactive flow demo — forced light mode */}
      <section className="relative w-full flex-1 min-h-0 border border-border overflow-hidden group" style={{ '--background': '0 0% 100%', '--foreground': '240 10% 3.9%', '--muted': '240 8% 82%', '--muted-foreground': '240 3.8% 46.1%', '--border': '240 5.9% 90%' } as React.CSSProperties}>
        <DemoFlow />
        <div className="absolute inset-0 flex items-end justify-center pb-5 pointer-events-none opacity-100 group-hover:opacity-0 transition-opacity duration-500">
          <span className="bg-background/90 border border-border px-5 py-2 font-mono text-xs text-muted-foreground uppercase tracking-wider">
            <span className="hidden sm:inline">Drag to pan · Scroll or pinch to zoom</span>
            <span className="sm:hidden">Touch to pan · Pinch to zoom</span>
          </span>
        </div>
      </section>

      {/* arrow down */}
      <div className="flex flex-col align-center justify-end">
        <ChevronDownIcon className="w-16 h-16 text-muted-foreground" />
      </div>

    </section>
  )
}
