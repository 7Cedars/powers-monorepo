'use client'

import React from "react";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { cn } from "@/utils/utils"; 
import { Checks } from "@/context/types";

// Human-readable descriptions for each check
const checkDescriptions: Record<string, string> = {
  authorised: "You are not authorised to perform this action",
  actionExists: "This action does not exist",
  voteActive: "Voting is not currently active",
  proposalPassed: "The proposal has not passed",
  fulfilled: "This action has not been fulfilled",
  actionNotFulfilled: "This action has already been fulfilled",
  mandateFulfilled: "Another mandate needs to be fulfilled first",
  mandateNotFulfilled: "Another mandate should not have been fulfilled",
  delayPassed: "Required delay period has not passed",
  throttlePassed: "Execution is being throttled, please wait",
};

/**
 * Gets a failed check and its human-readable description
 */
const getFailedCheck = (checks: Checks | undefined): string | null => {
  if (!checks) return null;
  
  for (const [key, value] of Object.entries(checks)) {
    // Skip allPassed and hasVoted
    if (key === 'allPassed' || key === 'hasVoted') continue;
    
    if (value === false && checkDescriptions[key]) {
      return checkDescriptions[key];
    }
  }
  
  return null;
};

interface SubmitButtonProps {
  canSubmit: boolean;
  onSubmit: () => void;
  status: "idle" | "pending" | "success" | "error";
  isSubmitting: boolean;
  needsVote: boolean;
  showFallback?: boolean;
  checks: Checks | undefined; 
}

/**
 * SubmitButton - A reusable button component for submitting actions.
 * Displays different states: idle, pending (with spinner), success, and error.
 * Shows a fallback message when the action cannot be submitted.
 * 
 * @param canSubmit - Whether the action can be submitted
 * @param onSubmit - Callback when the button is clicked
 * @param status - Current transaction status
 * @param isSubmitting - Whether a transaction is being submitted
 * @param needsVote - Whether the action requires a vote (changes button text)
 * @param showFallback - Whether to show the fallback message when canSubmit is false
 * @param checks - The checks object containing validation results
 */
export const SubmitButton: React.FC<SubmitButtonProps> = ({
  canSubmit,
  onSubmit,
  status,
  isSubmitting,
  needsVote,
  showFallback = false,
  checks
}) => {
  if (canSubmit) {
    return (
      <button
        onClick={onSubmit}
        disabled={status === "pending" && isSubmitting}
        className={cn(
          "w-full mt-4 border  px-4 py-2.5 text-xs font-mono",
          "uppercase tracking-wider transition-colors",
          "flex items-center justify-center gap-2",
          status === "pending" && isSubmitting && "opacity-70 cursor-not-allowed",
          status === "success" && isSubmitting && "bg-green-600 text-white border-green-600",
          status === "error" && isSubmitting && "bg-red-600 text-white border-red-600",
          (!isSubmitting || status === "idle") && "bg-primary text-primary-foreground border-primary hover:bg-primary/90 hover:border-primary/90"
        )}
      >
        {status === "pending" && isSubmitting && (
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
        )}
        {status === "pending" && isSubmitting && "Waiting for Confirmation"}
        {status === "success" && isSubmitting && "Transaction Confirmed!"}
        {status === "error" && isSubmitting && "Transaction Failed"}
        {(!isSubmitting || status === "idle") && (needsVote ? 'Propose Action' : 'Execute Action')}
      </button>
    );
  }

  // Fallback message when action cannot be submitted
  if (showFallback) {
    const failedCheckMessage = getFailedCheck(checks);
    
    return (
      <div className="w-full mt-4 p-4 text-xs text-muted-foreground text-center">
        {failedCheckMessage 
          ? `Cannot submit: ${failedCheckMessage}`
          : "Action cannot be submitted due to failed checks or an error."
        }
      </div>
    );
  }

  return null;
};