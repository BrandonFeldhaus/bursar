"use client";

import { useRef, type RefObject } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { IconX } from "@tabler/icons-react";

const FIELD = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';
const ACTION = "button:not([disabled]), a[href]";

/**
 * Where focus lands when a modal opens: an explicit [data-autofocus], then (mouse or keyboard) the first
 * field in the body, then its first button or link. On a touch screen a focused field throws the keyboard
 * up over a form nobody has seen yet, so the panel itself takes focus instead. Base UI's own default would
 * pick the first tabbable element, which is the header's close button.
 */
export function modalInitialFocus(popup: RefObject<HTMLElement | null>, body: RefObject<HTMLElement | null>) {
  return (openType: string) => {
    const auto = body.current?.querySelector<HTMLElement>("[data-autofocus]");
    if (auto) return auto;
    if (openType === "touch" || window.matchMedia("(pointer: coarse)").matches) return popup.current;
    return body.current?.querySelector<HTMLElement>(FIELD) ?? body.current?.querySelector<HTMLElement>(ACTION) ?? true;
  };
}

/**
 * Mobile slide-up drawer on Base UI's Drawer: portalled to <body>, swipe down / Escape / backdrop to close,
 * focus trapped inside and returned to the opener on close, page scroll locked while open. Keep it mounted
 * and drive `open` so the close transition can play.
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
  const popupRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      swipeDirection="down"
    >
      <Drawer.Portal>
        <Drawer.Backdrop className="dialog-overlay" />
        <Drawer.Viewport className="dialog-viewport dialog-viewport--sheet">
          <Drawer.Popup
            ref={popupRef}
            className="bottom-sheet"
            initialFocus={modalInitialFocus(popupRef, bodyRef)}
          >
            <div className="bottom-sheet__head">
              <Drawer.Title className="bottom-sheet__title" render={<h3 />}>{title}</Drawer.Title>
              <Drawer.Close className="btn btn--icon" aria-label="Close">
                <IconX size={16} aria-hidden="true" />
              </Drawer.Close>
            </div>
            <div className="bottom-sheet__body" ref={bodyRef}>
              {children}
            </div>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
