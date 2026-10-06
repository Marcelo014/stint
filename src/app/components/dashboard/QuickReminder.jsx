"use client";

import { useEffect, useRef, useState } from "react";
import {
  MESSAGE_MAX,
  localDateToTimestamp,
  todayLocalDate,
} from "@/lib/reminders";

/**
 * Compact "set reminder" popover for a dashboard card.
 *
 * Lives inside a [data-stop-nav] region so opening it never navigates into
 * the card. Escape closes it, as with every other dismissible control.
 */
export default function QuickReminder({ applicationId }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const popoverRef = useRef(null);
  const savedTimeout = useRef(null);

  const today = todayLocalDate();

  useEffect(() => {
    if (!open) return;

    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  async function submit() {
    if (!date) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/applications/${applicationId}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remind_at: localDateToTimestamp(date),
          message: message.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not set reminder");
        return;
      }

      setOpen(false);
      setDate("");
      setMessage("");
      setSaved(true);
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
      savedTimeout.current = setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error("Quick reminder failed:", err);
      setError("Could not set reminder");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={popoverRef} data-stop-nav>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="rounded-md px-2 py-1 text-xs text-text-subtle transition hover:bg-card-hover hover:text-text"
      >
        {saved ? "✓ Reminder set" : "⏰ Remind me"}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-60 rounded-lg border border-border bg-card p-3 shadow-lg">
          <label className="mb-1.5 block text-xs font-medium text-text-muted">
            Remind me on
          </label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={(e) => {
              setDate(e.target.value);
              setError("");
            }}
            className="w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text outline-none transition focus:border-accent"
          />
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Optional message"
            maxLength={MESSAGE_MAX}
            className="mt-2 w-full rounded-md border border-border bg-bg px-2 py-1.5 text-xs text-text placeholder-text-subtle outline-none transition focus:border-accent"
          />
          {error && (
            <p className="mt-2 text-xs text-status-rejected">{error}</p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={submit}
              disabled={saving || !date}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
            >
              {saving ? "Saving..." : "Set reminder"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-text-muted transition hover:text-text"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
