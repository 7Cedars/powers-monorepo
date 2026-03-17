'use client'

import * as React from "react";
import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface ForumModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  className?: string;
}

/**
 * ForumModal - A generic modal component that can display any content.
 * Handles open/close state, overlay, and modal positioning using pure Tailwind CSS.
 * 
 * @param open - Controls whether the modal is visible
 * @param onOpenChange - Callback when modal open state changes
 * @param children - Content to display inside the modal
 * @param className - Optional additional CSS classes
 */
export const ForumModal: React.FC<ForumModalProps> = ({
  open,
  onOpenChange,
  children,
  className
}) => {
  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    if (open) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [open, onOpenChange]);

  // Handle click outside to close modal
  const handleOverlayClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  if (!open) return null;

  // Use portal to render modal at document body level
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        )}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />
      
      {/* Modal Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-50 w-full max-w-lg bg-background border shadow-lg",
          "animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200",
          "p-6",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
