"use client";

import { useState, useEffect } from "react";

interface Props {
  text: string;
  startDelay?: number;
  className?: string;
}

export function TypewriterText({ text, startDelay = 0, className }: Props) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setStarted(true), startDelay);
    return () => clearTimeout(t);
  }, [startDelay]);

  useEffect(() => {
    if (!started || displayed.length >= text.length) {
      if (displayed.length >= text.length) setDone(true);
      return;
    }
    // Random delay between 35ms (fast burst) and 130ms (hesitation)
    const delay = Math.random() < 0.15
      ? Math.random() * 180 + 120   // occasional longer pause
      : Math.random() * 60 + 35;    // normal keystroke speed

    const t = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, delay);

    return () => clearTimeout(t);
  }, [started, displayed, text]);

  return (
    <span className={className}>
      {displayed}
      {started && !done && (
        <span className="animate-pulse ml-px">|</span>
      )}
    </span>
  );
}