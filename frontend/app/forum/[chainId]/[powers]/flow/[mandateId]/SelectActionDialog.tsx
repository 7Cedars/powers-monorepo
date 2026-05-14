"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { cn } from "@/utils/utils";
import { useLatestActions, ActionWithBlockNumber } from "@/hooks/useLatestActions";
import { useBlocks } from "@/hooks/useBlocks";
import { toFullDateAndTimeFormat } from "@/utils/toDates";
import { ForumModal } from "@/components/ForumModal";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { usePowersStore } from "@/context/store";

export interface SelectedActionInfo {
  actionId: string;
  datetime: string;
  description: string;
}

interface SelectActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect?: (actionInfo: SelectedActionInfo) => void;
  actions?: ActionWithBlockNumber[];
}

export function SelectActionDialog({
  open,
  onOpenChange,
  onSelect,
  actions: providedActions,
}: SelectActionDialogProps) {
  const { chainId } = useParams<{ chainId: string }>();
  const powers = usePowersStore();
  
  const fetchedActions = useLatestActions(25);
  const latestActions = providedActions ?? fetchedActions;
  const { timestamps, fetchTimestamps } = useBlocks();

  // Fetch timestamps for all actions when modal opens
  React.useEffect(() => {
    if (open && latestActions.length > 0 && chainId) {
      const blockNumbers = latestActions.map(action => action.highestBlockNumber);
      fetchTimestamps(blockNumbers, chainId);
    }
  }, [open, latestActions, chainId, fetchTimestamps]);

  const handleActionClick = (actionId: string, blockNumber: bigint, description?: string) => {
    const actionInfo: SelectedActionInfo = {
      actionId,
      datetime: getActionDatetime(blockNumber),
      description: description || "No description"
    };

    if (onSelect) {
      onSelect(actionInfo);
    }
    onOpenChange(false);
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

  return (
    <ForumModal open={open} onOpenChange={onOpenChange} className="font-mono max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm text-foreground">Select an Action</h3>
          <p className="text-xs text-muted-foreground">
            Choose an action to view its flow
          </p>
        </div>
        <button
          onClick={() => onOpenChange(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>

      {/* Actions List */}
      <div className="max-h-[32rem] overflow-y-auto border border-border">
        {latestActions.length === 0 ? (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No actions found
          </div>
        ) : (
          latestActions.map((action) => {
            const mandate = powers?.mandates?.find(m => m.index === action.mandateId);
            const mandateName = mandate?.nameDescription ? mandate.nameDescription.split(':')[0] : 'Unknown';
            
            return (
              <button
                key={action.actionId}
                onClick={() => handleActionClick(action.actionId, action.highestBlockNumber, action.description)}
                className={cn(
                  "relative flex w-full cursor-pointer select-none flex-col gap-1 px-4 py-3 text-sm outline-none transition-colors",
                  "hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                  "text-left border-b border-border last:border-b-0"
                )}
              >
                <div className="text-xs font-semibold text-foreground mb-1">
                  #{action.mandateId.toString()} - {mandateName}
                </div>
                <div className="flex items-center justify-between gap-2 w-full">
                  <span className="text-xs text-muted-foreground">
                    {getActionDatetime(action.highestBlockNumber)}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {abbreviateActionId(action.actionId)}
                  </span>
                </div>
                <div className="text-sm mt-1">
                  {abbreviateDescription(action.description)}
                </div>
              </button>
            );
          })
        )}
      </div>
    </ForumModal>
  );
}
