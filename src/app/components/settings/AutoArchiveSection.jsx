"use client";

import { useEffect, useRef, useState } from "react";

const PRESETS = [30, 60, 90];
const MIN_DAYS = 1;
const MAX_DAYS = 365;

export default function AutoArchiveSection() {
  const [profile, setProfile] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState("");
  const savedTimeout = useRef(null);

  // Whether the custom field is showing is UI state, not a stored value: a
  // saved 45 is "custom", a saved 60 is a preset.
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (!d.profile) {
          setLoadFailed(true);
          return;
        }
        setProfile(d.profile);
        const days = d.profile.auto_archive_days;
        if (days && !PRESETS.includes(days)) {
          setCustomOpen(true);
          setCustomValue(String(days));
        }
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

  async function save(days) {
    setSaving(true);
    setShowSaved(false);
    setError("");
    if (savedTimeout.current) clearTimeout(savedTimeout.current);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auto_archive_days: days }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Could not save");
        return;
      }

      setProfile(data.profile);
      setShowSaved(true);
      savedTimeout.current = setTimeout(() => setShowSaved(false), 2500);
    } catch (err) {
      console.error("Save failed:", err);
      setError("Could not save");
    } finally {
      setSaving(false);
    }
  }

  function selectOff() {
    setCustomOpen(false);
    setCustomValue("");
    if (profile.auto_archive_days !== null) save(null);
  }

  function selectPreset(days) {
    setCustomOpen(false);
    setCustomValue("");
    if (profile.auto_archive_days !== days) save(days);
  }

  function openCustom() {
    setCustomOpen(true);
    setCustomValue(
      profile.auto_archive_days ? String(profile.auto_archive_days) : ""
    );
  }

  // Auto-save on blur, only if the value actually changed.
  function saveCustom() {
    const trimmed = customValue.trim();
    if (trimmed === "") return;

    const days = Number(trimmed);
    if (!Number.isInteger(days) || days < MIN_DAYS || days > MAX_DAYS) {
      setError(`Enter a whole number of days between ${MIN_DAYS} and ${MAX_DAYS}`);
      return;
    }
    setError("");
    if (days !== profile.auto_archive_days) save(days);
  }

  const current = profile?.auto_archive_days ?? null;
  const isOff = current === null;
  const activePreset = !customOpen && PRESETS.includes(current) ? current : null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-6">
      <h2 className="text-lg font-semibold text-text">Auto-Archive</h2>
      <p className="mt-1 text-sm text-text-muted">
        Quietly archive applications with no activity for a while. Nothing is
        deleted, and anything with an upcoming interview is left alone.
      </p>

      {loadFailed ? (
        <p className="mt-4 text-sm text-text-muted">
          Couldn&apos;t load your preferences. Try reloading the page.
        </p>
      ) : !profile ? (
        <div className="mt-4 h-10 animate-pulse rounded-lg bg-bg" />
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Choice label="Off" active={isOff && !customOpen} onClick={selectOff} />
            {PRESETS.map((days) => (
              <Choice
                key={days}
                label={`${days} days`}
                active={activePreset === days}
                onClick={() => selectPreset(days)}
              />
            ))}
            <Choice label="Custom" active={customOpen} onClick={openCustom} />
          </div>

          {customOpen && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={MIN_DAYS}
                max={MAX_DAYS}
                value={customValue}
                onChange={(e) => {
                  setCustomValue(e.target.value);
                  setError("");
                }}
                onBlur={saveCustom}
                aria-label="Custom auto-archive days"
                className="w-24 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none transition focus:border-accent"
              />
              <span className="text-sm text-text-muted">days of no activity</span>
            </div>
          )}

          <p className="mt-3 text-xs text-text-subtle">
            {isOff
              ? "Auto-archive is off — nothing will be archived for you."
              : `Applications with no activity for ${current} days get archived on the next daily run.`}
          </p>

          {error && <p className="mt-2 text-xs text-status-rejected">{error}</p>}

          <p
            className={`mt-4 text-sm text-accent transition-opacity duration-500 ${
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

function Choice({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "bg-accent text-white"
          : "border border-border bg-bg text-text-muted hover:border-accent hover:text-text"
      }`}
    >
      {label}
    </button>
  );
}
