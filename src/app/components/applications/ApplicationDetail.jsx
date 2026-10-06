"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/app/components/Navbar";
import { ROUND_TYPES } from "@/lib/rounds";
import RemindersSection from "./RemindersSection";
import {
  localInputToTimestamp,
  timestampToLocalInput,
} from "@/lib/reminders";

const NEW_STATUS_COLOR = "#7A8C5E";
const NEW_STATUS_OPTION = "__new_status__";

const SOURCES = ["LinkedIn", "Handshake", "Referral", "Company site", "Cold email", "Other"];

const MARKER_CONFIG = {
  exclamation: { icon: "!", label: "Urgent", active: "bg-status-rejected text-white", inactive: "bg-card-hover text-text-subtle" },
  star: { icon: "★", label: "Favorite", active: "bg-status-applied text-white", inactive: "bg-card-hover text-text-subtle" },
  pin: { icon: "📌", label: "Pinned", active: "bg-accent text-white", inactive: "bg-card-hover text-text-subtle" },
  clock: { icon: "⏱", label: "Follow up", active: "bg-status-oa text-white", inactive: "bg-card-hover text-text-subtle" },
};

export default function ApplicationDetail({
  application: initial,
  statuses: initialStatuses,
  rounds: initialRounds,
  reminders: initialReminders,
}) {
  const router = useRouter();
  const [app, setApp] = useState(initial);
  const [markers, setMarkers] = useState(initial.card_markers || []);
  const [rounds, setRounds] = useState(initialRounds || []);
  const [statuses, setStatuses] = useState(initialStatuses || []);
  const [creatingStatus, setCreatingStatus] = useState(false);
  const [newStatusName, setNewStatusName] = useState("");
  const [newStatusColor, setNewStatusColor] = useState(NEW_STATUS_COLOR);
  const [statusError, setStatusError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingRound, setAddingRound] = useState(false);
  const savedTimeout = useRef(null);

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

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  // Wraps any inline save in the shared transient Saving.../Saved indicator.
  // `request` resolves false to report a failed save and skip the checkmark.
  const withSaveIndicator = useCallback(async (request) => {
    setSaving(true);
    setShowSaved(false);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);

    try {
      const ok = await request();
      if (ok !== false) {
        setShowSaved(true);
        savedTimeout.current = setTimeout(() => setShowSaved(false), 2500);
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, []);

  const save = useCallback(
    (updates) =>
      withSaveIndicator(async () => {
        const res = await fetch(`/api/applications/${app.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setApp(data.application);
      }),
    [app.id, withSaveIndicator]
  );

  // Rounds are their own rows — saving one never touches the application,
  // so changing a round can't move the application's status.
  const saveRound = useCallback(
    (roundId, updates) =>
      withSaveIndicator(async () => {
        const res = await fetch(`/api/rounds/${roundId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setRounds((prev) => prev.map((r) => (r.id === roundId ? data.round : r)));
      }),
    [withSaveIndicator]
  );

  async function addRound() {
    setAddingRound(true);
    try {
      const res = await fetch(`/api/applications/${app.id}/rounds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setRounds((prev) => [...prev, data.round]);
      }
    } catch (err) {
      console.error("Add round failed:", err);
    } finally {
      setAddingRound(false);
    }
  }

  async function deleteRound(roundId) {
    try {
      const res = await fetch(`/api/rounds/${roundId}`, { method: "DELETE" });
      if (res.ok) setRounds((prev) => prev.filter((r) => r.id !== roundId));
    } catch (err) {
      console.error("Delete round failed:", err);
    }
  }

  function handleBlur(field, value, original) {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed !== (original || "")) {
      save({ [field]: trimmed || null });
    }
  }

  async function toggleMarker(markerType) {
    setMarkers((prev) => {
      const exists = prev.some((m) => m.marker_type === markerType);
      if (exists) return prev.filter((m) => m.marker_type !== markerType);
      return [...prev, { marker_type: markerType }];
    });

    try {
      const res = await fetch(`/api/applications/${app.id}/markers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marker_type: markerType }),
      });
      if (res.ok) {
        const data = await res.json();
        setMarkers(data.markers);
      }
    } catch (err) {
      console.error("Toggle marker failed:", err);
    }
  }

  async function createAndAssignStatus() {
    const name = newStatusName.trim();
    if (!name) return;

    setSavingStatus(true);
    setStatusError("");
    try {
      const res = await fetch("/api/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color_hex: newStatusColor }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || "Could not create status");
        return;
      }
      setStatuses((prev) => [...prev, data.status]);
      setCreatingStatus(false);
      setNewStatusName("");
      setNewStatusColor(NEW_STATUS_COLOR);
      // save() writes the PATCH response back, so app.statuses updates too
      save({ status_id: data.status.id });
    } catch (err) {
      console.error("Create status failed:", err);
      setStatusError("Could not create status");
    } finally {
      setSavingStatus(false);
    }
  }

  function handleStatusSelect(value) {
    if (value === NEW_STATUS_OPTION) {
      setStatusError("");
      setCreatingStatus(true);
      return;
    }
    const newStatus = statuses.find((s) => s.id === value);
    setApp((prev) => ({
      ...prev,
      status_id: value,
      statuses: newStatus || prev.statuses,
    }));
    save({ status_id: value });
  }

  useEffect(() => {
    if (!creatingStatus) return;
    function handleKey(e) {
      if (e.key === "Escape") setCreatingStatus(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [creatingStatus]);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: "DELETE",
      });
      if (res.ok) router.push("/");
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
  const orderedRounds = [...rounds].sort((a, b) => a.sort_order - b.sort_order);

  // The assigned status may be hidden, and hidden statuses aren't in the
  // list — fold it in so the select still shows what's actually set.
  const statusOptions = statuses.some((s) => s.id === app.status_id)
    ? statuses
    : [...statuses, status].filter(Boolean);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <button
            onClick={() => router.push("/")}
            className="text-sm text-text-muted transition hover:text-text"
          >
            ← Back to dashboard
          </button>

          {/* Company + Job Title */}
          <div className="mt-6">
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              onBlur={() => handleBlur("company_name", companyName, app.company_name)}
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

          {app.is_archived && (
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-dashed border-border bg-card px-4 py-3">
              <span className="rounded-full bg-card-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
                {app.archived_reason === "auto" ? "Auto-archived" : "Archived"}
              </span>
              <p className="text-sm text-text-muted">
                {app.archived_reason === "auto"
                  ? "Archived automatically after a spell of no activity. Restoring it brings it straight back."
                  : "This application is archived and hidden from your active list."}
              </p>
            </div>
          )}

          {/* Status + Markers row */}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3">
              {status && (
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: status.color_hex }}
                />
              )}
              <select
                value={app.status_id || ""}
                onChange={(e) => handleStatusSelect(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
              >
                {statusOptions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.is_hidden ? " (hidden)" : ""}
                  </option>
                ))}
                <option value={NEW_STATUS_OPTION}>+ New status</option>
              </select>
            </div>

            {/* Markers */}
            <div className="flex items-center gap-2">
              {Object.entries(MARKER_CONFIG).map(([type, config]) => {
                const active = markers.some((m) => m.marker_type === type);
                return (
                  <button
                    key={type}
                    onClick={() => toggleMarker(type)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      active ? config.active : config.inactive
                    } hover:opacity-80`}
                    title={config.label}
                  >
                    {config.icon} {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {creatingStatus && (
            <div className="mt-3 rounded-lg border border-border bg-card p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={newStatusColor}
                  onChange={(e) => setNewStatusColor(e.target.value)}
                  aria-label="New status color"
                  className="h-9 w-10 cursor-pointer rounded-md border border-border bg-bg p-1"
                />
                <input
                  type="text"
                  value={newStatusName}
                  onChange={(e) => setNewStatusName(e.target.value)}
                  placeholder="New status name"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
                />
                <button
                  onClick={createAndAssignStatus}
                  disabled={savingStatus || !newStatusName.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
                >
                  {savingStatus ? "Creating..." : "Create & assign"}
                </button>
                <button
                  onClick={() => setCreatingStatus(false)}
                  className="text-sm text-text-muted transition hover:text-text"
                >
                  Cancel
                </button>
              </div>
              {statusError && (
                <p className="mt-2 text-xs text-status-rejected">{statusError}</p>
              )}
            </div>
          )}

          {/* Fields grid */}
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Date Applied">
              <input
                type="date"
                value={dateApplied}
                onChange={(e) => setDateApplied(e.target.value)}
                onBlur={() => handleBlur("date_applied", dateApplied, app.date_applied)}
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
                onBlur={() => handleBlur("recruiter_name", recruiterName, app.recruiter_name)}
                placeholder="e.g. Jane Smith"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
              />
            </Field>

            <Field label="Recruiter Email">
              <input
                type="email"
                value={recruiterEmail}
                onChange={(e) => setRecruiterEmail(e.target.value)}
                onBlur={() => handleBlur("recruiter_email", recruiterEmail, app.recruiter_email)}
                placeholder="e.g. jane@company.com"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
              />
            </Field>
          </div>

          {/* Notes */}
          <div className="mt-8">
            <label className="mb-1 block text-sm font-medium text-text-muted">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => handleBlur("notes", notes, app.notes)}
              rows={5}
              placeholder="Anything you want to remember about this application..."
              className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
            />
          </div>

          {/* Interview timeline */}
          <div className="mt-10">
            <h2 className="text-base font-semibold text-text">Interview timeline</h2>

            {orderedRounds.length === 0 ? (
              <p className="mt-2 text-sm text-text-subtle">
                No rounds yet — add one to start tracking this loop.
              </p>
            ) : (
              <ol className="mt-4 space-y-3">
                {orderedRounds.map((round, i) => (
                  <RoundRow
                    key={round.id}
                    round={round}
                    position={i + 1}
                    onSave={saveRound}
                    onDelete={() => deleteRound(round.id)}
                  />
                ))}
              </ol>
            )}

            <button
              onClick={addRound}
              disabled={addingRound}
              className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-text-muted transition hover:border-accent hover:text-text disabled:opacity-50"
            >
              {addingRound ? "Adding..." : "+ Add round"}
            </button>
          </div>

          <RemindersSection
            applicationId={app.id}
            reminders={initialReminders}
          />

          {/* Save indicator + Delete */}
          <div className="mt-12 flex items-center justify-between border-t border-border pt-6">
            <p
              className={`text-sm text-accent transition-opacity duration-500 ${
                saving || showSaved ? "opacity-100" : "opacity-0"
              }`}
            >
              {saving ? "Saving..." : "✓ Saved"}
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => save({ is_archived: !app.is_archived })}
                className="text-sm font-medium text-accent transition hover:text-accent-hover"
              >
                {app.is_archived ? "Restore to active" : "Archive"}
              </button>
              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-sm text-status-rejected transition hover:text-status-rejected/80"
                >
                  Delete this application
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-text-muted">Permanently delete?</p>
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
        </div>
      </main>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-text-muted">{label}</label>
      {children}
    </div>
  );
}

function RoundRow({ round, position, onSave, onDelete }) {
  // scheduled_date is TIMESTAMPTZ, so the input is datetime-local and the
  // value is converted both ways through the browser's own zone. Feeding a
  // raw ISO string to the input (or sending one back) is what shifts an
  // evening US-Eastern interview onto the following day.
  const [scheduledDate, setScheduledDate] = useState(
    round.scheduled_date ? timestampToLocalInput(round.scheduled_date) : ""
  );
  const [notes, setNotes] = useState(round.notes || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    function handleKey(e) {
      if (e.key === "Escape") setConfirmDelete(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [confirmDelete]);

  function handleBlur(field, value, original) {
    const trimmed = typeof value === "string" ? value.trim() : value;
    if (trimmed !== (original || "")) {
      onSave(round.id, { [field]: trimmed || null });
    }
  }

  // Compared as instants, not strings: the same moment has many valid string
  // forms, and only a real change should trigger a save.
  function saveScheduledDate() {
    const next = scheduledDate ? localInputToTimestamp(scheduledDate) : null;
    const current = round.scheduled_date
      ? new Date(round.scheduled_date).getTime()
      : null;
    const nextMs = next ? new Date(next).getTime() : null;
    if (nextMs === current) return;
    onSave(round.id, { scheduled_date: next });
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-text-subtle">{position}</span>

        <select
          value={round.round_type || ROUND_TYPES[0]}
          onChange={(e) => onSave(round.id, { round_type: e.target.value })}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-text outline-none transition focus:border-accent"
        >
          {ROUND_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        <input
          type="datetime-local"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          onBlur={saveScheduledDate}
          aria-label="Scheduled date and time"
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-text outline-none transition focus:border-accent"
        />

        <label className="flex items-center gap-2 text-sm text-text-muted">
          <input
            type="checkbox"
            checked={round.is_completed || false}
            onChange={(e) => onSave(round.id, { is_completed: e.target.checked })}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          Completed
        </label>

        <div className="ml-auto">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-text-subtle transition hover:text-status-rejected"
            >
              Remove
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Remove this round?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md bg-status-rejected px-2.5 py-1 text-xs font-medium text-white transition hover:bg-status-rejected/80 disabled:opacity-50"
              >
                {deleting ? "Removing..." : "Yes"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-text-muted transition hover:text-text"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={() => handleBlur("notes", notes, round.notes)}
        rows={2}
        placeholder="Notes for this round..."
        className="mt-3 w-full resize-y rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
      />
    </li>
  );
}