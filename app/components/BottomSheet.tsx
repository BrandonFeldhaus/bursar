"use client";

import { useRef } from "react";
import { IconX } from "@tabler/icons-react";
import { useModal } from "../lib/useModal";
import { useSheetKeyboard } from "../lib/useSheetKeyboard";

/**
 * Mobile slide-up drawer. Escape and the overlay close it; focus moves in (the panel itself on touch
 * screens, so the keyboard doesn't open over it) and back to the opener on close. When the keyboard
 * does open, the sheet pins itself above it (useSheetKeyboard).
 */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModal(open, onClose, panelRef);
  useSheetKeyboard(open, panelRef);

  if (!open) return null;

  return (
    <div
      className="dialog-overlay dialog-overlay--sheet"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bottom-sheet" ref={panelRef} tabIndex={-1}>
        <div className="bottom-sheet__head">
          <h3 className="bottom-sheet__title">{title}</h3>
          <button
            className="btn btn--icon"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="bottom-sheet__body">{children}</div>
      </div>
    </div>
  );
}
