"use client";

import { useEffect, useRef, useState } from "react";
import {
  MESSAGE_MAX,
  localDateToTimestamp,
  timestampToLocalDate,
  todayLocalDate,
} from "@/lib/reminders";

/**
 * "Mon, Oct 6" in the browser's own zone. remind_at is timestamptz, so it has
 * to be rendered locally — formatting in UTC shows the wrong day for anyone
 * west of Greenwich.
 */
export function formatReminderDate(value) {
  return new Date(value).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function RemindersSection({ applicationId, reminders: initial }) {
  const [reminders, setReminders] = useState(initial || []);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeout = useRef(null);

  const today = todayLocalDate();

  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  function flashSaved() {
    setShowSaved(true);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);
    savedTimeout.current = setTimeout(() => setShowSaved(false), 2500);
  }

  async function addReminder() {
    if (!date) return;

    setAdding(true);
    setError("");
    setSaving(true);
    try {
      const res = await fetch(`/api/applications/${applicationId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // The picked date becomes the instant it starts in this browser's
          // zone, so it can't land on the previous day in the database.
          remind_at: localDateToTimestamp(date),
          message: message.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not add reminder");
        return;
      }

      setReminders((prev) =>
        [...prev, data.reminder].sort(
          (a, b) => Date.parse(a.remind_at) - Date.parse(b.remind_at)
        )
      );
      setDate("");
      setMessage("");
      flashSaved();
    } catch (err) {
      console.error("Add reminder failed:", err);
      setError("Could not add reminder");
    } finally {
      setAdding(false);
      setSaving(false);
    }
  }

  async function deleteReminder(id) {
    const previous = reminders;
    setReminders((prev) => prev.filter((r) => r.id !== id));

    try {
      const res = await fetch(`/api/reminders/${id}`, { method: "DELETE" });
      if (!res.ok) setReminders(previous);
      else flashSaved();
    } catch (err) {
      console.error("Delete reminder failed:", err);
      setReminders(previous);
    }
  }

  return (
    <div className="mt-10">
      <h2 className="text-base font-semibold text-text">Reminders</h2>
      <p className="mt-1 text-sm text-text-muted">
        You&apos;ll get these in your daily email, if email reminders are on.
      </p>

      {reminders.length === 0 ? (
        <p className="mt-3 text-sm text-text-subtle">
          No reminders on this application yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {reminders.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              today={today}
              onDelete={() => deleteReminder(reminder.id)}
            />
          ))}
        </ul>
      )}

      {/* No <form> — submit is a button, per project convention */}
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label
            htmlFor="reminder-date"
            className="mb-1.5 block text-xs font-medium text-text-muted"
          >
            Remind me on
          </label>
          <input
            id="reminder-date"
            type="date"
            value={date}
            min={today}
            onChange={(e) => {
              setDate(e.target.value);
              setError("");
            }}
            className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label
            htmlFor="reminder-message"
            className="mb-1.5 block text-xs font-medium text-text-muted"
          >
            Message <span className="text-text-subtle">(optional)</span>
          </label>
          <input
            id="reminder-message"
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Follow up with the recruiter"
            maxLength={MESSAGE_MAX}
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
          />
        </div>
        <button
          onClick={addReminder}
          disabled={adding || !date}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
        >
          {adding ? "Adding..." : "Add reminder"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-status-rejected">{error}</p>}

      <p
        className={`mt-3 text-sm text-accent transition-opacity duration-500 ${
          saving || showSaved ? "opacity-100" : "opacity-0"
        }`}
      >
        {saving ? "Saving..." : "✓ Saved"}
      </p>
    </div>
  );
}

function ReminderRow({ reminder, today, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!confirmDelete) return;
    function handleKey(e) {
      if (e.key === "Escape") setConfirmDelete(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [confirmDelete]);

  const localDate = timestampToLocalDate(reminder.remind_at);
  const overdue = !reminder.is_sent && localDate < today;
  const dueToday = localDate === today;

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg bg-bg px-4 py-2.5">
      <span className="text-sm font-medium text-text">
        {formatReminderDate(reminder.remind_at)}
      </span>

      {overdue && (
        <span className="rounded-full bg-status-rejected/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-rejected">
          Overdue
        </span>
      )}
      {dueToday && !reminder.is_sent && (
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
          Today
        </span>
      )}
      {reminder.is_sent && (
        <span className="rounded-full bg-card-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
          Sent
        </span>
      )}

      <span className="min-w-0 flex-1 truncate text-sm text-text-muted">
        {reminder.message || <span className="text-text-subtle">No message</span>}
      </span>

      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 text-xs text-text-subtle transition hover:text-status-rejected"
        >
          Delete
        </button>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-text-muted">Delete?</span>
          <button
            onClick={onDelete}
            className="rounded-md bg-status-rejected px-2.5 py-1 text-xs font-medium text-white transition hover:bg-status-rejected/80"
          >
            Yes
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-text-muted transition hover:text-text"
          >
            Cancel
          </button>
        </div>
      )}
    </li>
  );
}
