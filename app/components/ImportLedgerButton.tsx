"use client";

import type { ChangeEvent, ReactNode } from "react";
import { normalizeParsed, saveState } from "../lib/storage";

/** Unwraps a Bursar export (`{ data }`), a legacy `{ budgetAppV1 }` file, or a bare state. */
function unwrapImport(parsed: unknown): unknown {
  if (typeof parsed !== "object" || parsed === null) return parsed;
  if ("data" in parsed) return (parsed as { data?: unknown }).data;
  if ("budgetAppV1" in parsed) return (parsed as { budgetAppV1?: unknown }).budgetAppV1;
  return parsed;
}

/**
 * A `.btn`-styled label wrapping the hidden file input. Reads a JSON export, runs it
 * through normalizeParsed, saves it, then reloads so every page picks it up.
 */
export function ImportLedgerButton({
  className = "btn btn--ghost",
  children = "Import JSON",
  onStatus,
}: {
  className?: string;
  children?: ReactNode;
  onStatus?: (message: string) => void;
}) {
  async function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const incoming = unwrapImport(JSON.parse(await file.text()));
      if (!incoming || typeof incoming !== "object") {
        onStatus?.("Import failed: invalid budget file.");
        return;
      }
      saveState(normalizeParsed(incoming));
      onStatus?.("Import complete. Reloading…");
      setTimeout(() => window.location.reload(), 300);
    } catch {
      onStatus?.("Import failed: invalid JSON.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <label className={className}>
      {children}
      <input type="file" accept="application/json,.json" onChange={onChange} className="fileInputHidden" />
    </label>
  );
}
