"use client";

import { useState, useEffect } from "react";

const SENTENCES = [
  "to ensure privacy for netizens.",
  "to be accessible to all.",
  "to coordinate across borders.",
  "to separate powers by design.",
  "to make governance verifiable.",
  "to enable anonymous participation.",
  "to govern without intermediaries.",
];

type Phase = "typing" | "holding" | "erasing" | "pausing";

export function CyclingTypewriter({ className }: { className?: string }) {
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<Phase>("pausing");

  useEffect(() => {
    const sentence = SENTENCES[index];

    if (phase === "pausing") {
      const t = setTimeout(() => setPhase("typing"), 500);
      return () => clearTimeout(t);
    }

    if (phase === "typing") {
      if (displayed.length >= sentence.length) {
        setPhase("holding");
        return;
      }
      const delay =
        Math.random() < 0.15
          ? Math.random() * 100 + 80
          : Math.random() * 50 + 30;
      const t = setTimeout(
        () => setDisplayed(sentence.slice(0, displayed.length + 1)),
        delay
      );
      return () => clearTimeout(t);
    }

    if (phase === "holding") {
      const t = setTimeout(() => setPhase("erasing"), 3000);
      return () => clearTimeout(t);
    }

    if (phase === "erasing") {
      if (displayed.length === 0) {
        setIndex((i) => (i + 1) % SENTENCES.length);
        setPhase("pausing");
        return;
      }
      const delay = Math.random() * 20 + 15;
      const t = setTimeout(() => setDisplayed((d) => d.slice(0, -1)), delay);
      return () => clearTimeout(t);
    }
  }, [phase, displayed, index]);

  return (
    <span className={className}>
      {displayed}
      <span className="animate-pulse ml-px">|</span>
    </span>
  );
}
