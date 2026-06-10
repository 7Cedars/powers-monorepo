"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { DeployedExamples } from "@/public/organisations/DeployedExamples";

export function SectionExamples() {
  const router = useRouter();
  const [selected, setSelected] = useState(0);

  if (DeployedExamples.length === 0) return null;

  const org = DeployedExamples[selected];
  const total = DeployedExamples.length;
  const isComingSoon = org.address === '0x0000000000000000000000000000000000000000';

  const prev = () => setSelected(i => (i - 1 + total) % total);
  const next = () => setSelected(i => (i + 1) % total);

  return (
    <section id="examples" className="w-full min-h-screen flex flex-col items-center px-4 bg-muted/25 border-t border-border py-16">

      {/* Title & subtitle */}
      <div className="w-full flex flex-col justify-center items-center pb-10">
        <div className="w-full flex flex-col gap-1 justify-center items-center md:text-4xl text-xl font-mono font-bold text-foreground max-w-4xl text-center text-pretty pb-2 uppercase tracking-wider">
          Explore: Example Organisations
        </div>
        <div className="w-full flex flex-col gap-4 justify-center items-center text-muted-foreground max-w-3xl text-center text-pretty font-mono">
          <span className="md:text-lg text-sm">Each organisation built on Powers Protocol comes with two interface components out of the box: a <span className="font-semibold text-foreground">forum</span>, where members chat, propose, and vote; and an <span className="font-semibold text-foreground">overview</span>, which displays the full history of every decision and transaction the organisation has made on-chain. These aren't locked-in products — they're functional starting points that any organisation can build on and customise to their own needs.</span>
          <span className="text-sm leading-relaxed">Below are some live implementations:</span>
        </div>
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-0 border border-border bg-background dark:bg-white">

        {/* Banner — 2:1 */}
        <div className="w-full aspect-[2/1] flex-shrink-0 bg-muted/30 border-b border-border overflow-hidden">
          {org.banner ? (
            <img
              src={org.banner}
              alt={`${org.title} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground dark:text-gray-400 uppercase tracking-wider">Banner image</span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="px-6 pt-5 pb-2 font-mono font-bold text-foreground dark:text-gray-900 uppercase tracking-wider text-base border-t border-border text-center">
          {org.title}
        </div>

        {/* Description */}
        <div className="px-6 pb-5 font-mono text-sm text-muted-foreground dark:text-gray-600 leading-relaxed text-center">
          {org.description}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0">
          <button
            onClick={() => !isComingSoon && router.push(`/forum/${org.chainId}/${org.address}`)}
            disabled={isComingSoon}
            className="flex-1 py-3 font-mono text-sm uppercase tracking-wider border transition-colors cursor-pointer disabled:cursor-not-allowed text-foreground dark:text-gray-900"
            style={{ borderColor: isComingSoon ? 'hsl(var(--border))' : '#CD5E20' }}
            onMouseEnter={e => { if (!isComingSoon) e.currentTarget.style.backgroundColor = 'hsl(var(--muted))' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
          >
            {isComingSoon ? 'Coming Soon' : 'Go to Forum'}
          </button>
          <button
            onClick={() => !isComingSoon && router.push(`/overview/${org.chainId}/${org.address}/home`)}
            disabled={isComingSoon}
            className="flex-1 py-3 font-mono text-sm uppercase tracking-wider border transition-colors cursor-pointer disabled:cursor-not-allowed text-foreground dark:text-gray-900"
            style={{ borderColor: isComingSoon ? 'hsl(var(--border))' : '#CD5E20' }}
            onMouseEnter={e => { if (!isComingSoon) e.currentTarget.style.backgroundColor = 'hsl(var(--muted))' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
          >
            {isComingSoon ? 'Coming Soon' : 'Go to Overview'}
          </button>
        </div>

      </div>

      {/* Controls */}
      <div className="w-full max-w-3xl flex items-center justify-between px-2 pt-4">
        <button onClick={prev} className="p-2 border border-border hover:bg-muted transition-colors cursor-pointer" aria-label="Previous">
          <ChevronLeftIcon className="w-5 h-5 text-foreground" />
        </button>

        <div className="flex flex-col items-center gap-2 mx-auto sm:mx-0">
          <div className="flex gap-2 items-center">
            {DeployedExamples.map((_, i) => (
              <button
                key={i}
                onClick={() => setSelected(i)}
                className={`w-2 h-2 transition-colors cursor-pointer ${i === selected ? 'bg-foreground' : 'bg-muted-foreground/30 hover:bg-muted-foreground/60'}`}
                aria-label={`Go to example ${i + 1}`}
              />
            ))}
          </div>
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
            {selected + 1} / {total}
          </span>
        </div>

        <button onClick={next} className="p-2 border border-border hover:bg-muted transition-colors cursor-pointer" aria-label="Next">
          <ChevronRightIcon className="w-5 h-5 text-foreground" />
        </button>
      </div>

    </section>
  );
}