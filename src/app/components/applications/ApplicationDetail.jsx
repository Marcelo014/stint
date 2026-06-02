"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";

const SOURCES = ["LinkedIn", "Handshake", "Referral", "Company site", "Cold email", "Other"];

export default function ApplicationDetail({ application: initial, statuses }) {
  const router = useRouter();
  const [app, setApp] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Local field states
  const [companyName, setCompanyName] = useState(app.company_name);
  const [jobTitle, setJobTitle] = useState(app.job_title);
  const [dateApplied, setDateApplied] = useState(app.date_applied);
  const [jobUrl, setJobUrl] = useState(app.job_url || "");
  const [deadline, setDeadline] = useState(app.deadline || "");
  const [salary, setSalary] = useState(app.salary || "");
  const [recruiterName, setRecruiterName] = useState(app.recruiter_name || "");
  const [recruiterEmail, setRecruiterEmail] = useState(app.recruiter_email || "");
  const [source, setSource] = useState(app.source || "");
  const [notes, setNotes] = useState(app.notes || "");

  const save = useCallback(
    async (updates) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/applications/${app.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.ok) {
          const data = await res.json();
          setApp(data.application);
        }
      } catch (err) {
        console.error("Save failed:", err);
      } finally {
        setSaving(false);
      }
    },
    [app.id]
  );

  function handleBlur(field, value, original) {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed !== (original || "")) {
      save({ [field]: trimmed || null });
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.push("/dashboard");
    } catch (err) {
      console.error("Delete failed:", err);
      setDeleting(false);
    }
  }

  useEffect(() => {
    if (!showDeleteConfirm) return;
    function handleKey(e) {
      if (e.key === "Escape") setShowDeleteConfirm(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showDeleteConfirm]);

  const status = app.statuses;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg px-6 py-8">
        <div className="mx-auto max-w-3xl">
          {/* Back */}
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-text-muted transition hover:text-text"
          >
            ← Back to dashboard
          </button>

          {/* Saving indicator */}
          {saving && <p className="mt-2 text-xs text-accent">Saving...</p>}

          {/* Company + Job Title */}
          <div className="mt-6">
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onBlur={() =>
                handleBlur("company_name", companyName, app.company_name)
              }
              className="w-full bg-transparent text-2xl font-semibold text-text outline-none placeholder-text-subtle"
              placeholder="Company name"
            />
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onBlur={() => handleBlur("job_title", jobTitle, app.job_title)}
              className="mt-1 w-full bg-transparent text-lg text-text-muted outline-none placeholder-text-subtle"
              placeholder="Job title"
            />
          </div>

          {/* Status */}
          <div className="mt-6 flex items-center gap-3">
            {status && (
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ backgroundColor: status.color_hex }}
              />
            )}
            <select
              value={app.status_id || ""}
              onChange={(e) => {
                const newStatusId = e.target.value;
                const newStatus = statuses.find((s) => s.id === newStatusId);
                setApp((prev) => ({
                  ...prev,
                  status_id: newStatusId,
                  statuses: newStatus || prev.statuses,
                }));
                save({ status_id: newStatusId });
              }}
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fields grid */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Date Applied">
              <input
                type="date"
                value={dateApplied}
                onChange={(e) => setDateApplied(e.target.value)}
                onBlur={() =>
                  handleBlur("date_applied", dateApplied, app.date_applied)
                }
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
              />
            </Field>

            <Field label="Deadline">
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                onBlur={() => handleBlur("deadline", deadline, app.deadline)}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
              />
            </Field>

            <Field label="Salary">
              <input
                type="text"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                onBlur={() => handleBlur("salary", salary, app.salary)}
                placeholder="e.g. $25/hr or $80,000"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
              />
            </Field>

            <Field label="Source">
              <select
                value={source}
                onChange={(e) => {
                  setSource(e.target.value);
                  save({ source: e.target.value || null });
                }}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value="">— Select —</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Job URL">
              <input
                type="url"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                onBlur={() => handleBlur("job_url", jobUrl, app.job_url)}
                placeholder="https://..."
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
              />
            </Field>

            <Field label="Recruiter Name">
              <input
                type="text"
                value={recruiterName}
                onChange={(e) => setRecruiterName(e.target.value)}
                onBlur={() =>
                  handleBlur("recruiter_name", recruiterName, app.recruiter_name)
                }
                placeholder="e.g. Jane Smith"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
              />
            </Field>

            <Field label="Recruiter Email">
              <input
                type="email"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                onBlur={() =>
                  handleBlur(
                    "recruiter_email",
                    recruiterEmail,
                    app.recruiter_email
                  )
                }
                placeholder="e.g. jane@company.com"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
              />
            </Field>
          </div>

          {/* Notes */}
          <div className="mt-8">
            <label className="mb-1 block text-sm font-medium text-text-muted">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => handleBlur("notes", notes, app.notes)}
              rows={5}
              placeholder="Anything you want to remember about this application..."
              className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
            />
          </div>

          {/* Delete */}
          <div className="mt-12 border-t border-border pt-6">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-status-rejected transition hover:text-status-rejected/80"
              >
                Delete this application
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <p className="text-sm text-text-muted">
                  Permanently delete this application?
                </p>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-status-rejected px-4 py-1.5 text-sm font-medium text-white transition hover:bg-status-rejected/80 disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Yes, delete"}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-sm text-text-muted transition hover:text-text"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}