"use client";

import { ChevronDownIcon } from "@heroicons/react/24/outline";

export function SectionForum() {
  return (
    <section id="forum" className="w-full min-h-screen flex flex-col items-center px-4 bg-background border-t border-border py-16">
      <div className="w-full max-w-3xl flex flex-col gap-6 items-center text-center">

        <div className="font-mono font-bold text-foreground md:text-4xl text-xl uppercase tracking-wider">
          What is the user experience?
        </div>

        <div className="font-mono text-muted-foreground text-sm leading-relaxed">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </div>

        {/* Video placeholder */}
        <div className="w-full aspect-video bg-muted/30 border border-border flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 rounded-full border border-muted-foreground/40 flex items-center justify-center">
            <div className="w-0 h-0 ml-1" style={{ borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '14px solid hsl(var(--muted-foreground))' }} />
          </div>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Video coming soon</span>
        </div>

      </div>

      {/* arrow down */}
      <div className="flex flex-col items-center justify-end pt-10">
        <button
          onClick={() => document.getElementById('page-footer')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="scroll-arrow"
          aria-label="Scroll to footer"
        >
          <ChevronDownIcon className="w-16 h-16" />
        </button>
      </div>
    </section>
  );
}