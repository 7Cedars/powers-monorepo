"use client";

import { useState, useEffect, useRef, useCallback, TouchEvent } from "react";
import {
  ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon,
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

  const cardWidth = containerWidth < 500 ? containerWidth * 0.78 : containerWidth * 0.55;

  // Recompute track offset whenever current or container size changes
  useEffect(() => {
    const centerOffset = (containerWidth - cardWidth) / 2;
    setTrackOffset(-current * (cardWidth + GAP) + centerOffset);
  }, [current, containerWidth, cardWidth]);

  const next = useCallback(() => setCurrent(i => (i + 1) % total), [total]);
  const prev = useCallback(() => setCurrent(i => (i - 1 + total) % total), [total]);

  const touchStartX = useRef<number | null>(null);
  const onTouchStart = (e: TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) diff > 0 ? next() : prev();
    touchStartX.current = null;
  };

  // Auto-advance
  useEffect(() => {
    if (paused) return;
    const id = setInterval(next, 7000);
    return () => clearInterval(id);
  }, [paused, next]);

  return (
    <main
      className="w-full flex flex-col justify-start items-center bg-background border-t border-border pt-8 pb-16 md:py-16 px-4"
      id="powersApplications"
    >
      <div className="w-full flex flex-col gap-12 items-center">

        {/* Title & subtitle */}
        <div className="w-full flex flex-col justify-center items-center">
          <div className="w-full flex flex-col gap-1 justify-center items-center md:text-4xl text-xl font-mono font-bold text-foreground max-w-4xl text-center text-pretty pb-2 uppercase tracking-wider">
            Governance, solved structurally
          </div>
          <div className="w-full flex flex-col gap-4 justify-center items-center text-muted-foreground max-w-3xl text-center text-pretty font-mono">
            <span className="md:text-lg text-sm">Move beyond token voting. Design governance systems with real separation of powers.</span>
            <span className="text-sm leading-relaxed">On-chain governance is broken — researchers rank token voting failure as the single most urgent problem in crypto, followed by governance theater and informal power capture. The root cause is structural: most DAOs collapse proposal, deliberation, and execution into one blunt instrument. Powers Protocol fixes that.</span>
          </div>
        </div>

        {/* Carousel track */}
        <div
          ref={containerRef}
          className="w-full max-w-4xl overflow-hidden"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
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
                  className="flex flex-col bg-background dark:bg-white transition-all duration-500"
                  style={{
                    border: '2px solid #CD5E20',
                    opacity: i === current ? 1 : 0.3,
                    transform: i === current ? "scale(1)" : "scale(0.96)",
                    cursor: i !== current ? "pointer" : "default",
                  }}
                >
                  <div className="w-full flex flex-col items-center gap-1 p-3 border-b border-border bg-muted/50">
                    {(() => { const Icon = ICON_MAP[card.icon]; return Icon ? <Icon className="w-5 h-5 text-foreground dark:text-gray-900" /> : null; })()}
                    <span className="font-mono font-bold text-foreground dark:text-gray-900 uppercase tracking-wider text-xs sm:text-sm text-center">{card.title}</span>
                  </div>
                  <div className="w-full flex flex-col justify-start items-center px-3 sm:px-6 py-3 gap-2 sm:gap-4">
                    {card.details.map((detail, j) => (
                      <div key={j} className="text-muted-foreground dark:text-gray-600 leading-relaxed text-xs sm:text-sm font-mono text-center">
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
            className="hidden sm:block p-2 border border-border hover:bg-muted transition-colors cursor-pointer"
            aria-label="Previous"
          >
            <ChevronLeftIcon className="w-5 h-5 text-foreground" />
          </button>

          <div className="flex flex-col items-center gap-2 mx-auto sm:mx-0">
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
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              {current + 1} / {total}
            </span>
          </div>

          <button
            onClick={next}
            className="hidden sm:block p-2 border border-border hover:bg-muted transition-colors cursor-pointer"
            aria-label="Next"
          >
            <ChevronRightIcon className="w-5 h-5 text-foreground" />
          </button>
        </div>

      </div>

      {/* arrow down */}
      <div className="flex flex-col items-center justify-end pt-10">
        <button
          onClick={() => document.getElementById('examples')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="scroll-arrow"
          aria-label="Scroll to next section"
        >
          <ChevronDownIcon className="w-16 h-16" />
        </button>
      </div>
    </main>
  );
}