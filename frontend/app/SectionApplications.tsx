"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronLeftIcon, ChevronRightIcon,
  QuestionMarkCircleIcon, Bars3Icon, ArrowTopRightOnSquareIcon,
  PuzzlePieceIcon, MagnifyingGlassIcon, ChatBubbleLeftIcon,
} from "@heroicons/react/24/outline";

const ICON_MAP: Record<string, React.ElementType> = {
  question:  QuestionMarkCircleIcon,
  bars:      Bars3Icon,
  external:  ArrowTopRightOnSquareIcon,
  puzzle:    PuzzlePieceIcon,
  magnifier: MagnifyingGlassIcon,
  comment:   ChatBubbleLeftIcon,
};
import { powersApplications } from "../public/powersApplications";

const GAP = 20;

export function SectionApplications() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [trackOffset, setTrackOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(700);
  const total = powersApplications.length;

  // Measure container width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const cardWidth = containerWidth * 0.55;

  // Recompute track offset whenever current or container size changes
  useEffect(() => {
    const centerOffset = (containerWidth - cardWidth) / 2;
    setTrackOffset(-current * (cardWidth + GAP) + centerOffset);
  }, [current, containerWidth, cardWidth]);

  const next = useCallback(() => setCurrent(i => (i + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(i => (i - 1 + total) % total), [total]);

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, 7000);
    return () => clearInterval(id);
  }, [paused, next]);

  return (
    <main
      className="w-full flex flex-col justify-start items-center bg-background border-t border-border py-16 px-4"
      id="powersApplications"
    >
      <div className="w-full flex flex-col gap-12 items-center">

        {/* Title & subtitle */}
        <div className="w-full flex flex-col justify-center items-center pt-10">
          <div className="w-full flex flex-col gap-1 justify-center items-center md:text-4xl text-2xl font-mono font-bold text-foreground max-w-4xl text-center text-pretty pb-2 uppercase tracking-wider">
            Governance, solved structurally
          </div>
          <div className="w-full flex flex-col gap-4 justify-center items-center text-muted-foreground max-w-3xl text-center text-pretty font-mono">
            <span className="md:text-xl text-lg">Move beyond simple token voting and design bespoke governance systems that fit your specific needs.</span>
            <span className="text-sm leading-relaxed">On-chain governance is broken. Across 52 structured interviews with DAO participants, researchers identified token voting failure as the single most urgent problem in crypto governance — followed by governance theater, informal power capture, and voting fatigue.</span>
            <span className="text-sm leading-relaxed">The root cause is structural: most DAOs have no actual separation of powers. A single token vote collapses proposal, deliberation, and execution into one blunt instrument. Powers Protocol is built to fix that.</span>
          </div>
        </div>

        {/* Carousel track */}
        <div
          ref={containerRef}
          className="w-full max-w-4xl overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div
            className="flex"
            style={{
              gap: `${GAP}px`,
              transform: `translateX(${trackOffset}px)`,
              transition: "transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
          >
            {powersApplications.map((card, i) => (
              <div
                key={i}
                style={{ width: `${cardWidth}px`, flexShrink: 0 }}
                className="transition-all duration-500"
                onClick={() => setCurrent(i)}
              >
                <div
                  className="flex flex-col bg-background min-h-[260px] transition-all duration-500"
                  style={{
                    border: '1px solid #CD5E20',
                    opacity: i === current ? 1 : 0.3,
                    transform: i === current ? "scale(1)" : "scale(0.96)",
                    cursor: i !== current ? "pointer" : "default",
                  }}
                >
                  <div className="w-full flex flex-col items-center gap-2 p-5 border-b border-border bg-muted/50">
                    {(() => { const Icon = ICON_MAP[card.icon]; return Icon ? <Icon className="w-6 h-6 text-foreground" /> : null; })()}
                    <span className="font-mono font-bold text-foreground uppercase tracking-wider text-sm text-center">{card.title}</span>
                  </div>
                  <div className="w-full flex flex-col justify-start items-center px-6 py-5 gap-4">
                    {card.details.map((detail, j) => (
                      <div key={j} className="text-muted-foreground leading-relaxed text-sm font-mono text-center">
                        {detail}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="w-full max-w-4xl flex items-center justify-between px-2">
          <button
            onClick={prev}
            className="p-2 border border-border hover:bg-muted transition-colors cursor-pointer"
            aria-label="Previous"
          >
            <ChevronLeftIcon className="w-5 h-5 text-foreground" />
          </button>

          <div className="flex gap-2 items-center">
            {powersApplications.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2 h-2 transition-colors cursor-pointer ${
                  i === current ? "bg-foreground" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
                aria-label={`Go to card ${i + 1}`}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="p-2 border border-border hover:bg-muted transition-colors cursor-pointer"
            aria-label="Next"
          >
            <ChevronRightIcon className="w-5 h-5 text-foreground" />
          </button>
        </div>

        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider pb-8">
          {current + 1} / {total}
        </span>

      </div>
    </main>
  );
}