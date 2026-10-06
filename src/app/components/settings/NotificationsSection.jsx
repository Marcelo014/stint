"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LEAD_TIME_OPTIONS } from "@/lib/reminders";

function leadLabel(days) {
  if (days === 0) return "On the day";
  if (days === 1) return "1 day before";
  return `${days} days before`;
}

export default function NotificationsSection() {
  const [profile, setProfile] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimeout = useRef(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.profile) setProfile(d.profile);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  // Selects and toggles save on change, not on blur.
  const save = useCallback(async (updates) => {
    setSaving(true);
    setShowSaved(false);
    if (savedTimeout.current) clearTimeout(savedTimeout.current);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return;
      const data = await res.json();
      setProfile(data.profile);
      setShowSaved(true);
      savedTimeout.current = setTimeout(() => setShowSaved(false), 2500);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  }, []);

  const enabled = profile?.email_notifications_enabled === true;

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-text">Notifications</h2>
      <p className="mt-1 text-sm text-text-muted">
        One daily email with interviews, deadlines and reminders that need you.
      </p>

      {loadFailed ? (
        <p className="mt-4 text-sm text-text-muted">
          Couldn&apos;t load your preferences. Try reloading the page.
        </p>
      ) : !profile ? (
        <div className="mt-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-bg" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm text-text">Email reminders</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Sent once a day, and only when there&apos;s something to say.
              </p>
            </div>
            <button
              onClick={() => save({ email_notifications_enabled: !enabled })}
              role="switch"
              aria-checked={enabled}
              aria-label="Email reminders"
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                enabled ? "bg-accent" : "bg-border"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-card transition-all ${
                  enabled ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div
            className={`mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-2 ${
              enabled ? "" : "opacity-50"
            }`}
          >
            <LeadTimeField
              id="interview-lead"
              label="Interview reminders"
              value={profile.interview_reminder_days}
              disabled={!enabled}
              onChange={(days) => save({ interview_reminder_days: days })}
            />
            <LeadTimeField
              id="deadline-lead"
              label="Deadline reminders"
              value={profile.deadline_reminder_days}
              disabled={!enabled}
              onChange={(days) => save({ deadline_reminder_days: days })}
            />
          </div>

          {!enabled && (
            <p className="mt-3 text-xs text-text-subtle">
              Turn email reminders on to use these.
            </p>
          )}

          <p
            className={`mt-5 text-sm text-accent transition-opacity duration-500 ${
              saving || showSaved ? "opacity-100" : "opacity-0"
            }`}
          >
            {saving ? "Saving..." : "✓ Saved"}
          </p>
        </>
      )}
    </section>
  );
}

function LeadTimeField({ id, label, value, disabled, onChange }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium text-text-muted"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition focus:border-accent disabled:cursor-not-allowed"
      >
        {LEAD_TIME_OPTIONS.map((days) => (
          <option key={days} value={days}>
            {leadLabel(days)}
          </option>
        ))}
      </select>
    </div>
  );
}
