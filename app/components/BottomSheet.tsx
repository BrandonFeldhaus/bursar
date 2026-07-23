"use client";

import { useEffect } from "react";
import { IconX } from "@tabler/icons-react";

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
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

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
      <div className="bottom-sheet">
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
