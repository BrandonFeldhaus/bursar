"use client";

import { ChangeEvent, useState } from "react";
import { clearBudget, loadBudget, saveBudget, type BudgetState } from "../lib/budgetStorage";
import { todayISO } from "../lib/month";

export default function SettingsPage() {
  const [status, setStatus] = useState("");

  function exportData() {
    const state = loadBudget();
    const now = new Date();
    const payload = {
      app: "Paper & Ink Ledger",
      format: "paperInkLedger:v1",
      exportedAt: now.toISOString(),
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paper-ink-ledger-${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus("Export complete.");
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      const incoming =
        typeof parsed === "object" && parsed !== null && "data" in parsed
          ? (parsed as { data?: unknown }).data
          : typeof parsed === "object" && parsed !== null && "budgetAppV1" in parsed
          ? (parsed as { budgetAppV1?: unknown }).budgetAppV1
          : parsed;
      if (!incoming || typeof incoming !== "object") {
        setStatus("Import failed: invalid budget file.");
        return;
      }
      saveBudget(incoming as BudgetState);
      setStatus("Import complete. Reloading…");
      setTimeout(() => window.location.reload(), 300);
    } catch {
      setStatus("Import failed: invalid JSON.");
    } finally {
      event.target.value = "";
    }
  }

  function resetOnboarding() {
    const confirmed = window.confirm("Reset all local budget data and reopen onboarding?");
    if (!confirmed) return;
    clearBudget();
    window.location.href = "/onboarding";
  }

  return (
    <section className="container">
      {/* Page head */}
      <header className="sheet sheet--ledger page-head">
        <p className="kicker">Settings</p>
        <h1 className="page-head__title">Archive tools</h1>
        <p className="page-head__lead">Manage exports, imports, and onboarding resets without changing the local storage key.</p>
        <div className="page-head__meta">
          <div className="page-head__meta-item">
            <span className="page-head__meta-label">Storage key</span>
            <span className="page-head__meta-value">paperInkLedger:v1</span>
          </div>
        </div>
      </header>

      {/* Settings cards */}
      <div className="settings-grid">
        <div className="sheet settings-card">
          <div className="row-between mb-3">
            <div>
              <p className="kicker">Backup</p>
              <h2 className="section-title">Backup &amp; restore</h2>
            </div>
            <span className="badge">v1</span>
          </div>
          <p className="muted">Export your ledger as JSON or import a previous archive into the same local versioned key.</p>
          <div className="settings-actions">
            <button className="btn" type="button" onClick={exportData}>
              Export JSON
            </button>
            <label className="btn btn--ghost" style={{ cursor: "pointer" }}>
              Import JSON
              <input type="file" accept="application/json,.json" onChange={importData} style={{ display: "none" }} />
            </label>
          </div>
        </div>

        <div className="sheet settings-card">
          <div className="row-between mb-3">
            <div>
              <p className="kicker">Reset</p>
              <h2 className="section-title">Onboarding reset</h2>
            </div>
          </div>
          <p className="muted">Clears local data and returns to the three-step flow. Use this only if you want to restart the ledger from a blank state on this device.</p>
          <div className="settings-actions">
            <button className="btn btn--danger" type="button" onClick={resetOnboarding}>
              Reset onboarding
            </button>
          </div>
        </div>
      </div>

      {/* Status message */}
      {status && (
        <div className="sheet" style={{ padding: "14px 22px" }}>
          <p className="muted" role="status">{status}</p>
        </div>
      )}

    </section>
  );
}
