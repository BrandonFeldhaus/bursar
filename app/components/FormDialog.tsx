"use client";

import { useRef, type ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { BottomSheet } from "./BottomSheet";
import { useIsMobile } from "../lib/useIsMobile";
import { useModal } from "../lib/useModal";

/**
 * The container every "+ Add X" button opens: a centered dialog on desktop, the
 * BottomSheet on mobile. Both close on Escape and overlay click, focus the first
 * field on open, and return focus to the button that opened them.
 */
export function FormDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  if (isMobile) {
    return (
      <BottomSheet open={open} title={title} onClose={onClose}>
        {children}
      </BottomSheet>
    );
  }
  return (
    <CenteredDialog open={open} title={title} onClose={onClose}>
      {children}
    </CenteredDialog>
  );
}

function CenteredDialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  useModal(open, onClose, panelRef);

  if (!open) return null;

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog dialog--form" ref={panelRef}>
        <div className="dialog__head">
          <h3 className="dialog__title">{title}</h3>
          <button className="btn btn--icon" type="button" onClick={onClose} aria-label="Close">
            <IconX size={16} aria-hidden="true" />
          </button>
        </div>
        <div className="dialog__body">{children}</div>
      </div>
    </div>
  );
}
