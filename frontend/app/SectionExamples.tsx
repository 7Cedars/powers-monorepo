"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
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
    <section id="examples" className="w-full min-h-screen flex flex-col items-center justify-start px-4 bg-muted/25 border-t border-border py-6 sm:py-10">

      {/* Title & subtitle */}
      <div className="w-full flex flex-col justify-center items-center pb-10 gap-3">
        <div className="w-full flex flex-col gap-1 justify-center items-center md:text-4xl text-xl font-mono font-bold text-foreground max-w-4xl text-center text-pretty uppercase tracking-wider">
          Explore
        </div>
        <p className="md:text-lg text-sm font-mono text-muted-foreground max-w-2xl text-center text-pretty">
          Every organisation on Powers Protocol ships with a <span className="font-semibold text-foreground">forum</span> for proposals and voting, and an <span className="font-semibold text-foreground">overview</span> of all on-chain decisions — functional defaults, not locked-in products.
        </p>
      </div>

      <div className="w-full max-w-3xl flex flex-col border border-border bg-background">

        {/* Banner — 2:1 */}
        <div className="w-full aspect-[2/1] max-h-[200px] sm:max-h-[280px] flex-shrink-0 bg-muted/30 overflow-hidden">
          {org.banner ? (
            <img
              src={org.banner}
              alt={`${org.title} banner`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Banner image</span>
            </div>
          )}
        </div>

        {/* Title + description */}
        <div className="px-6 py-5 border-t border-border flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-8">
          <div className="font-mono font-bold text-foreground uppercase tracking-wider text-base sm:w-40 flex-shrink-0">
            {org.title}
          </div>
          <div className="font-mono text-sm text-muted-foreground leading-relaxed line-clamp-4">
            {org.description}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 px-6 pb-6 flex-shrink-0 border-t border-border pt-4">
          <button
            onClick={() => !isComingSoon && router.push(`/forum/${org.chainId}/${org.address}`)}
            disabled={isComingSoon}
            className="flex-1 py-3 font-mono text-sm uppercase tracking-wider border transition-colors cursor-pointer disabled:cursor-not-allowed text-foreground"
            style={{ borderColor: isComingSoon ? 'hsl(var(--border))' : '#CD5E20' }}
            onMouseEnter={e => { if (!isComingSoon) e.currentTarget.style.backgroundColor = 'hsl(var(--muted))' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
          >
            {isComingSoon ? 'Coming Soon' : 'Forum'}
          </button>
          <button
            onClick={() => !isComingSoon && router.push(`/overview/${org.chainId}/${org.address}/organisation`)}
            disabled={isComingSoon}
            className="flex-1 py-3 font-mono text-sm uppercase tracking-wider border transition-colors cursor-pointer disabled:cursor-not-allowed text-foreground"
            style={{ borderColor: isComingSoon ? 'hsl(var(--border))' : '#CD5E20' }}
            onMouseEnter={e => { if (!isComingSoon) e.currentTarget.style.backgroundColor = 'hsl(var(--muted))' }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = '' }}
          >
            {isComingSoon ? 'Coming Soon' : 'Overview'}
          </button>
        </div>

      </div>

      {/* Controls */}
      <div className="w-full max-w-3xl flex items-center justify-between px-2 pt-4">
        <button onClick={prev} className="p-2 border border-border hover:bg-muted transition-colors cursor-pointer" aria-label="Previous">
          <ChevronLeftIcon className="w-5 h-5 text-foreground" />
        </button>

        <div className="flex flex-col items-center gap-2">
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

      {/* arrow down */}
      <div className="flex flex-col items-center justify-end pt-4">
        <ChevronDownIcon className="w-16 h-16 text-muted-foreground" />
      </div>

    </section>
  );
}