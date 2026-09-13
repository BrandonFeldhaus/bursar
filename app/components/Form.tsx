"use client";

import type { FormEvent, KeyboardEvent, ReactNode } from "react";

const FIELD = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * Enter (the mobile keyboard's return / "next" key) moves to the next field inside `currentTarget`, in DOM
 * order. On the last field it only blurs, which closes the keyboard — Enter never submits; the form's
 * button does. Textareas, buttons and links keep their own Enter. Attach it once, on the form or on the
 * row that holds the inputs — never per input.
 */
export function advanceOnEnter(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "Enter" || e.defaultPrevented) return;
  // Enter that confirms an IME composition (Safari reports it as keyCode 229 with isComposing false).
  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
  const target = e.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

  const fields = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(FIELD));
  const index = fields.indexOf(target);
  if (index === -1) return;

  // preventDefault in both cases stops the browser's implicit submit.
  e.preventDefault();
  const next = fields[index + 1];
  if (next) {
    // Synchronously, inside the key event: iOS drops the keyboard when focus moves after the event.
    next.focus();
  } else {
    target.blur();
  }
}

/**
 * A <form> for the add-a-row forms: Enter advances field to field and never submits (advanceOnEnter) —
 * only the type="submit" button does. Submit never reloads the page, and the browser's own validation
 * stays off because every form shows its own errors.
 */
export function Form({
  className,
  onSubmit,
  children,
}: {
  className?: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <form
      className={className}
      noValidate
      autoComplete="off"
      onKeyDown={advanceOnEnter}
      onSubmit={(e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
