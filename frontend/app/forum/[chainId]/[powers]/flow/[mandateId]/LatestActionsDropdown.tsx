"use client";

import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLatestActions, ActionWithBlockNumber } from "@/hooks/useLatestActions";
import { useBlocks } from "@/hooks/useBlocks";
import { toFullDateAndTimeFormat } from "@/utils/toDates";

interface LatestActionsDropdownProps {
  trigger: React.ReactNode | ((selectedAction: SelectedActionInfo | null) => React.ReactNode);
  align?: "start" | "center" | "end";
  sideOffset?: number;
  onSelect?: (actionInfo: SelectedActionInfo) => void;
  actions?: ActionWithBlockNumber[]; // Optional filtered actions
}

export interface SelectedActionInfo {
  actionId: string;
  datetime: string;
  description: string;
}

export function LatestActionsDropdown({
  trigger,
  align = "start",
  sideOffset = 4,
  onSelect,
  actions: providedActions,
}: LatestActionsDropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { chainId, powers } = useParams<{ chainId: string; powers: string }>();
  
  const fetchedActions = useLatestActions(25);
  const latestActions = providedActions ?? fetchedActions; // Use provided actions or fetch all
  const { timestamps, fetchTimestamps } = useBlocks();

  // Fetch timestamps for all actions when dropdown opens
  React.useEffect(() => {
    if (isOpen && latestActions.length > 0 && chainId) {
      const blockNumbers = latestActions.map(action => action.highestBlockNumber);
      fetchTimestamps(blockNumbers, chainId);
    }
  }, [isOpen, latestActions, chainId, fetchTimestamps]);

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

  const handleActionClick = (actionId: string, blockNumber: bigint, description?: string) => {
    const actionInfo: SelectedActionInfo = {
      actionId,
      datetime: getActionDatetime(blockNumber),
      description: description || "No description"
    };

    // Call the onSelect callback if provided
    if (onSelect) {
      onSelect(actionInfo);
    }
    setIsOpen(false);
  };

  const getActionDatetime = (blockNumber: bigint): string => {
    const key = `${chainId}:${blockNumber}`;
    const blockTimestamp = timestamps.get(key);
    
    if (blockTimestamp?.timestamp) {
      return toFullDateAndTimeFormat(Number(blockTimestamp.timestamp));
    }
    
    return `Block ${blockNumber}`;
  };

  const abbreviateDescription = (description?: string): string => {
    if (!description) return "No description";
    return description.length > 50 
      ? `${description.slice(0, 50)}...` 
      : description;
  };

  const abbreviateActionId = (actionId: string): string => {
    return actionId.length > 10 
      ? `${actionId.slice(0, 8)}...` 
      : actionId;
  };

  const alignmentClasses = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  };

  return (
    <div ref={dropdownRef} className="relative inline-block font-mono">
      {/* Trigger */}
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer py-0.5">
        {typeof trigger === 'function' ? trigger(null) : trigger}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute z-50 min-w-[24rem] max-w-[32rem] overflow-hidden border border-border bg-popover text-popover-foreground shadow-md",
            "animate-in fade-in-0 zoom-in-95",
            alignmentClasses[align]
          )}
          style={{ top: `calc(100% + ${sideOffset}px)` }}
        >
          <div className="max-h-[32rem] overflow-y-auto p-1">
            {latestActions.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No actions found
              </div>
            ) : (
              latestActions.map((action) => (
                <button
                  key={action.actionId}
                  onClick={() => handleActionClick(action.actionId, action.highestBlockNumber, action.description)}
                  className={cn(
                    "relative flex w-full cursor-pointer select-none flex-col gap-1 rounded-sm px-2 py-2 text-sm outline-none transition-colors",
                    "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    "text-left border-b border-border last:border-b-0"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {getActionDatetime(action.highestBlockNumber)}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground">
                      {abbreviateActionId(action.actionId)}
                    </span>
                  </div>
                  <div className="text-sm">
                    {abbreviateDescription(action.description)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}