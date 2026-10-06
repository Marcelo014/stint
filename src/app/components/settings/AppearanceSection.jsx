"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "@/app/components/theme/ThemeProvider";
import { THEME_OPTIONS } from "@/lib/theme";
import { CARD_SIZE_OPTIONS, resolveCardSize } from "@/lib/cardSize";

/**
 * Appearance and Default Card Size.
 *
 * One component for two sections because both write to /api/profile and share
 * the save indicator — splitting them would mean a second identical GET.
 *
 * The theme control reads its current value from ThemeProvider rather than
 * from the fetch below: the provider was already seeded with the server value
 * server-side, so the segmented control is correct on first paint instead of
 * flickering through a default while the profile loads.
 */
export default function AppearanceSection() {
  const { preference, setPreference } = useTheme();

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

  // Segmented controls and selects save on change, not on blur.
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

  // Apply locally first — the theme flips instantly and the write catches up.
  // A failed PATCH leaves this browser on the new theme and the stored value
  // behind, which beats making the user wait on a round trip to see a colour.
  function chooseTheme(value) {
    setPreference(value);
    save({ dark_mode_preference: value });
  }

  const defaultCardSize = resolveCardSize(null, profile?.default_card_size);

  const indicator = (
    <p
      className={`mt-4 text-sm text-accent transition-opacity duration-500 ${
        saving || showSaved ? "opacity-100" : "opacity-0"
      }`}
    >
      {saving ? "Saving..." : "✓ Saved"}
    </p>
  );

  return (
    <>
      <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-text">Appearance</h2>
        <p className="mt-1 text-sm text-text-muted">
          System follows your device&apos;s light or dark setting and changes
          with it.
        </p>

        <div
          role="radiogroup"
          aria-label="Theme"
          className="mt-4 inline-flex flex-wrap rounded-lg border border-border bg-bg p-1"
        >
          {THEME_OPTIONS.map((option) => {
            const selected = preference === option.value;
            return (
              <button
                key={option.value}
                role="radio"
                aria-checked={selected}
                onClick={() => chooseTheme(option.value)}
                className={`min-h-11 rounded-md px-4 text-sm font-medium transition ${
                  selected
                    ? "bg-accent text-accent-fg"
                    : "text-text-muted hover:text-text"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {loadFailed && (
          <p className="mt-3 text-xs text-text-subtle">
            Your theme is applied on this device, but couldn&apos;t be saved to
            your profile. Try reloading the page.
          </p>
        )}

        {indicator}
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-text">Default Card Size</h2>
        <p className="mt-1 text-sm text-text-muted">
          Every card that doesn&apos;t have its own size set uses this one. Pin
          a single card to a different size from its detail page.
        </p>
        <div className="mt-4">
          <select
            value={defaultCardSize}
            onChange={(e) => save({ default_card_size: e.target.value })}
            disabled={!profile}
            aria-label="Default card size"
            className="min-h-11 w-full rounded-lg border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent disabled:opacity-50 sm:w-auto"
          >
            {CARD_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {loadFailed && (
          <p className="mt-3 text-xs text-text-subtle">
            Couldn&apos;t load your default. Try reloading the page.
          </p>
        )}
        <dl className="mt-4 space-y-1.5 text-xs">
          {[
            ["Small", "Company, job title and status."],
            ["Medium", "Adds markers, reminders, round progress and dates."],
            ["Large", "Adds a notes preview, recruiter and deadline."],
          ].map(([size, shows]) => (
            <div key={size} className="flex gap-2">
              <dt className="w-16 shrink-0 font-medium text-text-muted">
                {size}
              </dt>
              <dd className="text-text-subtle">{shows}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
