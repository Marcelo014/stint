"use client";

import { useState, useEffect, useRef } from "react";

export default function CreateCardModal({ statuses, onClose, onCreated }) {
  const [companyName, setCompanyName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [dateApplied, setDateApplied] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [statusId, setStatusId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const companyRef = useRef(null);

  // Defaults to the Applied preset until the user picks something else.
  // Derived rather than synced into state, so there's no cascading render.
  const defaultStatusId =
    statuses.find((s) => s.name === "Applied" && s.is_preset)?.id || "";
  const selectedStatusId = statusId || defaultStatusId;

  // Focus company name input on mount
  useEffect(() => {
    companyRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!companyName.trim() || !jobTitle.trim()) {
      setError("Company name and job title are required");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          job_title: jobTitle.trim(),
          date_applied: dateApplied,
          status_id: selectedStatusId || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      onCreated(data.application);
    } catch {
      setError("Network error — try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-text">New Application</h2>

        <div className="mt-5 flex flex-col gap-4">
          {/* Company Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">
              Company *
            </label>
            <input
              ref={companyRef}
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Google"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
            />
          </div>

          {/* Job Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">
              Job Title *
            </label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Software Engineering Intern"
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
            />
          </div>

          {/* Date Applied */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">
              Date Applied
            </label>
            <input
              type="date"
              value={dateApplied}
              onChange={(e) => setDateApplied(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text-muted">
              Status
            </label>
            <select
              value={selectedStatusId}
              onChange={(e) => setStatusId(e.target.value)}
              className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-status-rejected">{error}</p>
          )}

          {/* Actions */}
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted transition hover:text-text"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}