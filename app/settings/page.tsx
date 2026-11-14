"use client";

import { useEffect, useState } from "react";
import { loadState, saveState } from "../lib/storage";
import { todayISO } from "../lib/month";
import { useHydrated } from "../lib/useHydrated";
import { eraseAllData } from "../lib/eraseAllData";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ImportLedgerButton } from "../components/ImportLedgerButton";
import { Hint, dismissHint, type HintId } from "../components/Hint";

export default function SettingsPage() {
  const hydrated = useHydrated();
  const [status, setStatus] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [hints, setHints] = useState<string[] | null>(null);

  useEffect(() => {
    if (!hydrated) return;
    setHints(loadState().meta.hints);
  }, [hydrated]);

  function dismiss(id: HintId) {
    const next = dismissHint(loadState(), id);
    saveState(next);
    setHints(next.meta.hints);
  }

  function showHintsAgain() {
    const next = loadState();
    saveState({ ...next, meta: { ...next.meta, hints: [] } });
    setHints([]);
    setStatus("Hints will show again on each page.");
  }

  async function exportData() {
    const state = loadState();
    const now = new Date();
    const payload = {
      app: "Bursar",
      format: "bursar:v1",
      exportedAt: now.toISOString(),
      data: state,
    };
    const json = JSON.stringify(payload, null, 2);
    const filename = `bursar-${todayISO()}.json`;

    // Phones (and the installed iPhone app, where a download link is unreliable) get the share
    // sheet — "Save to Files" on iOS. Desktop keeps a plain download.
    const file = new File([json], filename, { type: "application/json" });
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (touch && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename });
        setStatus("Export complete.");
      } catch (err) {
        // The user closed the share sheet: nothing was saved, nothing to report.
        if ((err as Error)?.name !== "AbortError") setStatus("Export didn’t finish. Try again.");
      }
      return;
    }

    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking straight away can cancel the download before the browser has read the file (iOS).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatus("Export complete.");
  }

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet page-head">
        <h1 className="page-head__title">Settings</h1>
        <p className="page-head__lead">Back up your data, restore it from a saved file, or erase everything and start fresh.</p>
      </header>

      {hints && <Hint id="settings" hints={hints} onDismiss={dismiss} />}

      {/* Settings cards */}
      <div className="settings-grid">
        <div className="sheet settings-card">
          <div className="row-between mb-3">
            <h2 className="section-title">Backup &amp; restore</h2>
            <span className="badge">v1</span>
          </div>
          <p className="muted">Save everything to a JSON file, or load it back from a previously exported file.</p>
          <div className="settings-actions">
            <button className="btn" type="button" onClick={exportData}>
              Export JSON
            </button>
            <ImportLedgerButton onStatus={setStatus}>Import JSON</ImportLedgerButton>
          </div>
        </div>

        <div className="sheet settings-card">
          <div className="row-between mb-3">
            <h2 className="section-title">Start over</h2>
          </div>
          <p className="muted">Erases everything Bursar has stored in this browser and returns to an empty Overview. Export a backup first if you want to keep it. You can also bring back the one-line hints on each page.</p>
          <div className="settings-actions">
            <button className="btn btn--danger" type="button" onClick={() => setResetOpen(true)}>
              Erase all data
            </button>
            <button className="btn btn--ghost" type="button" onClick={showHintsAgain} disabled={!hints || hints.length === 0}>
              Show hints again
            </button>
          </div>
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div className="sheet sheet--bar">
          <p className="muted" role="status">{status}</p>
        </div>
      )}

      <ConfirmDialog
        open={resetOpen}
        title="Erase all data?"
        body="This deletes your income, bills, budget, goals, and month snapshots from this browser. This cannot be undone."
        confirmLabel="Erase"
        cancelLabel="Cancel"
        destructive
        onConfirm={eraseAllData}
        onCancel={() => setResetOpen(false)}
      />
    </section>
  );
}
