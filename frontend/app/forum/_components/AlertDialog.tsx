'use client'

import * as React from "react";
import { cn } from "@/lib/utils";
import { ForumModal } from "./ForumModal";

interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  cancelText?: string;
  confirmText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

/**
 * AlertDialog - A specialized modal for confirmation dialogs.
 * Uses ForumModal for the base modal functionality and adds alert-specific UI.
 * Uses pure Tailwind CSS for styling - no external UI library dependencies.
 * 
 * @param open - Controls whether the dialog is visible
 * @param onOpenChange - Callback when dialog open state changes
 * @param title - Title text for the alert
 * @param description - Description/message text for the alert
 * @param cancelText - Text for the cancel button (default: "Cancel")
 * @param confirmText - Text for the confirm button (default: "Confirm")
 * @param onConfirm - Callback when confirm button is clicked
 * @param onCancel - Optional callback when cancel button is clicked
 */
export const AlertDialog: React.FC<AlertDialogProps> = ({
  open,
  onOpenChange,
  title,
  description,
  cancelText = "Cancel",
  confirmText = "Confirm",
  onConfirm,
  onCancel
}) => {
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <ForumModal open={open} onOpenChange={onOpenChange} className="font-mono">
      {/* Header */}
      <div className="flex flex-col space-y-2 text-center sm:text-left">
        <h2 className="text-sm font-semibold tracking-wider font-mono">
          {title}
        </h2>
        <p className="text-xs leading-relaxed text-muted-foreground font-mono">
          {description}
        </p>
      </div>
      
      {/* Footer with buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6">
        <button
          onClick={handleCancel}
          className={cn(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium",
            "ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
            "h-10 px-4 py-2 mt-2 sm:mt-0 font-mono"
          )}
        >
          {cancelText}
        </button>
        <button
          onClick={handleConfirm}
          className={cn(
            "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium",
            "ring-offset-background transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:pointer-events-none disabled:opacity-50",
            "bg-primary text-primary-foreground hover:bg-primary/90",
            "h-10 px-4 py-2 font-mono"
          )}
        >
          {confirmText}
        </button>
      </div>
    </ForumModal>
  );
};
