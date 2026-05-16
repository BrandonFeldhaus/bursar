"use client";
import { useEffect, useRef } from "react";

export type UndoEntry = {
  id: string;
  message: string;
  onUndo: () => void;
  onCommit?: () => void;
};

export function UndoToast({
  entry,
  onDismiss,
  durationMs = 15000,
}: {
  entry: UndoEntry | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  const committedRef = useRef(false);

  // Keep latest callbacks in refs so the effect doesn't re-run when they change.
  const entryRef = useRef(entry);
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    entryRef.current = entry;
    onDismissRef.current = onDismiss;
  });

  // Only re-run the timer when the entry's identity actually changes.
  useEffect(() => {
    if (!entry) return;
    committedRef.current = false;

    const t = setTimeout(() => {
      if (!committedRef.current) {
        committedRef.current = true;
        entryRef.current?.onCommit?.();
        onDismissRef.current();
      }
    }, durationMs);

    return () => clearTimeout(t);
  }, [entry?.id, durationMs]);

  if (!entry) return null;

  return (
    <div className="undo-toast-wrap" role="status" aria-live="polite">
      <div className="undo-toast">
        <span className="undo-toast__msg">{entry.message}</span>
        <button
          type="button"
          className="undo-toast__btn"
          onClick={() => {
            if (committedRef.current) return;
            committedRef.current = true;
            entry.onUndo();
            onDismiss();
          }}
        >
          Undo
        </button>
      </div>
    </div>
  );
}