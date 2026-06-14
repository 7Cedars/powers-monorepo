"use client";

import { useEffect, useRef } from "react";
import { ChevronDownIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";

const SCROLL_BUDGET_VH = 250;

function findScrollContainer(el: HTMLElement | null): HTMLElement | null {
  while (el) {
    const { overflow, overflowY } = window.getComputedStyle(el);
    if (/(auto|scroll)/.test(overflow + overflowY)) return el;
    el = el.parentElement;
  }
  return null;
}

export function SectionIntro() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const para1Ref = useRef<HTMLParagraphElement>(null);
  const para2Ref = useRef<HTMLParagraphElement>(null);
  const para3Ref = useRef<HTMLParagraphElement>(null);
  const para4Ref = useRef<HTMLParagraphElement>(null);
  const para5Ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const scrollContainer = findScrollContainer(wrapper.parentElement);
    if (!scrollContainer) return;

    // Absolute scroll position where this section's sticky phase begins
    const containerRect = scrollContainer.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    const sectionStart = scrollContainer.scrollTop + (wrapperRect.top - containerRect.top);

    const onScroll = () => {
      const budget = (SCROLL_BUDGET_VH / 100) * window.innerHeight;
      const p = Math.min(1, Math.max(0, (scrollContainer.scrollTop - sectionStart) / budget));

      // Para 1: p 0.00 → 0.20
      if (para1Ref.current)
        para1Ref.current.style.opacity = String(Math.min(1, p / 0.15));
      // Para 2: p 0.25 → 0.45
      if (para2Ref.current)
        para2Ref.current.style.opacity = String(Math.min(1, Math.max(0, (p - 0.20) / 0.2)));
      // Para 3: p 0.50 → 0.70
      if (para3Ref.current)
        para3Ref.current.style.opacity = String(Math.min(1, Math.max(0, (p - 0.4) / 0.2)));
      // Para 4: p 0.75 → 0.95
      if (para4Ref.current)
        para4Ref.current.style.opacity = String(Math.min(1, Math.max(0, (p - 0.65) / 0.2)));
      // Para 5: p 0.85 → 1.00
      // if (para5Ref.current)
      //   para5Ref.current.style.opacity = String(Math.min(1, Math.max(0, (p - 0.85) / 0.2)));
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollContainer.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={wrapperRef} className="flex-none" style={{ height: `${100 + SCROLL_BUDGET_VH}vh` }}>
      <section id="intro" className="sticky top-0 w-full h-screen flex flex-col items-center bg-muted/25 border-t border-border px-6 py-16">

        <div className="flex flex-col justify-between flex-1 w-full max-w-4xl">
          <p ref={para1Ref} className="text-base sm:text-2xl font-mono text-foreground text-left text-pretty max-w-xl mr-auto" style={{ opacity: 0 }}>
            Without rules, human coordination becomes centralised, fragile, and unpredictable.
          </p>
          <p ref={para2Ref} className="text-base sm:text-2xl font-mono text-foreground text-right text-pretty max-w-xl ml-auto" style={{ opacity: 0 }}>
            Governance is in crisis. Rules exist, but there is little trust they are actually followed — centralised power, no accountability, inaccessible processes, no historical record.
          </p>
          <p ref={para3Ref} className="text-base sm:text-2xl font-mono text-foreground text-left text-pretty max-w-xl mr-auto" style={{ opacity: 0 }}>
            Powers makes rules enforceable: mandates — modular, role-restricted contracts — define who can take what action, and under which conditions. No hidden authority, no inaccessible processes.
          </p>
          <p ref={para4Ref} className="text-base sm:text-2xl font-mono text-foreground text-right text-pretty max-w-xl ml-auto" style={{ opacity: 0 }}>
            Communities can design their own governance systems: assign roles to accounts, grant powers to roles, build in checks and balances, and govern their own reforms.
          </p>
        </div>

        <a
          className="border-pulse mt-10 flex flex-row items-center gap-2 py-3 px-8 font-mono text-sm sm:text-base text-foreground uppercase tracking-wider border"
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'hsl(var(--muted))')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
          href="https://powers-docs.vercel.app/welcome"
          target="_blank"
          rel="noopener noreferrer"
        >
          Read the documentation
          <ArrowTopRightOnSquareIcon className="w-4 h-4 flex-shrink-0" />
        </a>
 

      </section>
    </div>
  );
}
