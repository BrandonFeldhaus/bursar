"use client";

import { useRef, type ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";
import { BottomSheet, modalInitialFocus } from "./BottomSheet";
import { useIsMobile } from "../lib/useIsMobile";

/**
 * The container every "+ Add X" button opens: a centered Base UI Dialog on desktop, the BottomSheet
 * (Base UI Drawer) on mobile, both portalled to <body>. Both close on Escape and backdrop click, trap
 * focus, focus the first field on open (the panel on touch screens), and return focus to the button
 * that opened them.
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
  const popupRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="dialog-overlay" />
        <Dialog.Viewport className="dialog-viewport">
          <Dialog.Popup
            ref={popupRef}
            className="dialog dialog--form"
            initialFocus={modalInitialFocus(popupRef, bodyRef)}
          >
            <div className="dialog__head">
              <Dialog.Title className="dialog__title" render={<h3 />}>{title}</Dialog.Title>
              <Dialog.Close className="btn btn--icon" aria-label="Close">
                <IconX size={16} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="dialog__body" ref={bodyRef}>
              {children}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
