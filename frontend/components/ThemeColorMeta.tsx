"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

export function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    // Remove any existing theme-color meta tags
    const existingMetaTags = document.querySelectorAll('meta[name="theme-color"]');
    existingMetaTags.forEach((tag) => tag.remove());

    // Create new meta tag with the appropriate color
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = resolvedTheme === "dark" ? "#09090b" : "#ffffff";
    document.head.appendChild(meta);

    return () => {
      meta.remove();
    }; 
  }, [resolvedTheme]);

  return null;
}