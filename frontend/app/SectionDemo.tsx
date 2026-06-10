"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { DemoFlow } from './DemoFlow';

export function SectionDemo() {

  return (
    <section id="demo" className="w-full h-screen flex flex-col items-center gap-4 bg-muted/25 border-t border-border px-4 py-8">

      <section className="relative w-full flex-1 min-h-0 border border-border overflow-hidden group">
        <DemoFlow />
      </section>

      {/* arrow down */}
      <div className="flex flex-col align-center justify-end">
        <ChevronDownIcon className="w-16 h-16 text-muted-foreground" />
      </div>

    </section>
  )
}
