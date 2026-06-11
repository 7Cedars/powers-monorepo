"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { CyclingTypewriter } from "./CyclingTypewriter";
import { ChevronDownIcon } from "@heroicons/react/24/outline";

// How many extra vh of scroll budget the sticky section consumes before releasing
const SCROLL_BUDGET_VH = 150;

function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  while (el) {
    const { overflow, overflowY } = window.getComputedStyle(el);
    if (/(auto|scroll)/.test(overflow + overflowY)) return el;
    el = el.parentElement;
  }
  return null;
}

export function HeroSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const text1Ref = useRef<HTMLParagraphElement>(null);
  const text2Ref = useRef<HTMLParagraphElement>(null);
  const text3Ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const scrollContainer = findScrollContainer(wrapper.parentElement);
    if (!scrollContainer) return;

    const onScroll = () => {
      const budget = (SCROLL_BUDGET_VH / 100) * window.innerHeight;
      const p = Math.min(1, scrollContainer.scrollTop / budget);

      // Text 1 fades in from p=0 to p=0.30
      if (text1Ref.current)
        text1Ref.current.style.opacity = String(Math.min(1, p / 0.30));
      // Text 2 fades in from p=0.35 to p=0.65
      if (text2Ref.current)
        text2Ref.current.style.opacity = String(
          Math.min(1, Math.max(0, (p - 0.35) / 0.30))
        );
      // Text 3 fades in from p=0.70 to p=1
      if (text3Ref.current)
        text3Ref.current.style.opacity = String(
          Math.min(1, Math.max(0, (p - 0.70) / 0.30))
        );
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // Wrapper provides the scroll budget; the sticky child consumes it
    <div ref={wrapperRef} className="flex-none" style={{ height: `${100 + SCROLL_BUDGET_VH}vh` }}>
      <section className="relative sticky top-0 w-full h-screen flex flex-col items-center bg-background">

        {/* Upper: logo + title + typewriter */}
        <div className="flex flex-col items-center pt-[10vh] sm:pt-[18vh]">
          <Image
            src="/logo1_notext.png" width={160} height={160} alt="Powers Protocol"
            className="mb-4 sm:mb-8 animate-in fade-in duration-700"
            style={{ animationFillMode: "both" }}
          />
          <h1
            className="text-3xl sm:text-7xl font-mono font-bold text-foreground text-center animate-in fade-in slide-in-from-bottom-4 duration-700"
            style={{ animationDelay: "300ms", animationFillMode: "both" }}
          >
            Trust governance
          </h1>
          <div
            className="mt-3 sm:mt-6 text-base sm:text-2xl font-mono text-muted-foreground text-center min-h-[2rem] animate-in fade-in duration-700"
            style={{ animationDelay: "800ms", animationFillMode: "both" }}
          >
            <CyclingTypewriter />
          </div>
        </div>

        {/* Lower: scroll-driven taglines */}
        <div className="flex-1 flex flex-col justify-center items-center gap-8 px-6 max-w-3xl w-full pb-20">
          <p
            ref={text1Ref}
            className="text-base sm:text-2xl font-mono text-foreground text-center text-pretty"
            style={{ opacity: 0 }}
          >
            <b>Powers Protocol</b> uses blockchain technology to add trust to governance.
          </p>
          <p
            ref={text2Ref}
            className="text-base sm:text-2xl font-mono text-foreground text-center text-pretty"
            style={{ opacity: 0 }}
          >
            Create rules that govern communities, organisations, movements — enforced by cryptography.
          </p>
          <p
            ref={text3Ref}
            className="text-base sm:text-2xl font-mono text-foreground text-center text-pretty"
            style={{ opacity: 0 }}
          >
            No tokens, no airdrops, no wallet needed. Just governance you can trust.
          </p>
        </div>

        <div
          className="absolute bottom-10 animate-in fade-in duration-700"
          style={{ animationDelay: "1200ms", animationFillMode: "both" }}
        >
          <ChevronDownIcon className="w-10 h-10 text-muted-foreground" />
        </div>
      </section>
    </div>
  );
}
