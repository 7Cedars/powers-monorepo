"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Powers } from "@/context/types";
import { cn } from "@/lib/utils";
import { usePowersStore } from "@/context/store";

interface NavigationDropdownMenuProps {
  savedProtocols: Powers[];
  trigger: React.ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function NavigationDropdownMenu({
  savedProtocols,
  trigger,
  align = "start",
  sideOffset = 4,
}: NavigationDropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const powers = usePowersStore();

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Close dropdown on escape key
  React.useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen]);

  const handleNavigation = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  const alignmentClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };

  return (
    <div ref={dropdownRef} className="relative inline-block font-mono">
      {/* Trigger */}
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 min-w-[12rem] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md",
            "animate-in fade-in-0 zoom-in-95",
            alignmentClasses[align]
          )}
          style={{ top: `calc(100% + ${sideOffset}px)` }}
        >
          <div className="p-1">
            {/* All DAOs */}
            <button
              onClick={() => handleNavigation("/forum")}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                "text-left"
              )}
            >
              All DAOs
            </button>

            {/* Profile */}
            <button
              onClick={() => handleNavigation("/forum/profile")}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                "text-left"
              )}
            >
              Profile
            </button>

            {/* Separator if there are saved protocols */}
            {savedProtocols.length > 0 && (
              <div className="-mx-1 my-1 h-px bg-border" />
            )}

            {/* Saved Protocols */}
            {savedProtocols.map((protocol) => (
              <button
                key={`${protocol.chainId}-${protocol.contractAddress}`}
                onClick={() =>
                  handleNavigation(
                    `/forum/${protocol.chainId}/${protocol.contractAddress}`
                  )
                }
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors",
                  "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                  "text-left"
                )}
              >
                {protocol.name || `Protocol ${protocol.contractAddress.slice(0, 6)}...`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
