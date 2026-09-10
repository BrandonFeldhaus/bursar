"use client";

import { useRef } from "react";
import { IconX } from "@tabler/icons-react";
import { useModal } from "../lib/useModal";

/** Mobile slide-up drawer. Escape and the overlay close it; focus goes to the first field and back to the opener on close. */
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
      <div className="bottom-sheet" ref={panelRef}>
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
