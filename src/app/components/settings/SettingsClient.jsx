"use client";

import { useState, useEffect } from "react";
import Navbar from "@/app/components/Navbar";

export default function SettingsClient() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/statuses")
      .then((r) => r.json())
      .then((d) => {
        setStatuses(d.statuses || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Settings
          </h1>

          {/* Status Management */}
          <section className="mt-8 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-text">Statuses</h2>
            <p className="mt-1 text-sm text-text-muted">
              Manage preset and custom statuses. Presets can be hidden but not
              deleted.
            </p>
            {loading ? (
              <div className="mt-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-lg bg-bg"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {statuses.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg bg-bg px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: s.color_hex }}
                      />
                      <span className="text-sm font-medium text-text">
                        {s.name}
                      </span>
                    </div>
                    <span className="text-xs text-text-subtle">
                      {s.is_preset ? "Preset" : "Custom"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 text-xs text-text-subtle italic">
              Custom status creation and reordering coming soon
            </p>
          </section>

          {/* Appearance */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-text">Appearance</h2>
            <p className="mt-1 text-sm text-text-muted">
              Theme and display preferences
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-text">Dark mode</span>
              <span className="rounded-md bg-bg px-3 py-1 text-xs text-text-subtle">
                Coming soon
              </span>
            </div>
          </section>

          {/* Default Card Size */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-text">
              Default Card Size
            </h2>
            <p className="mt-1 text-sm text-text-muted">
              New cards will use this size unless overridden
            </p>
            <div className="mt-4">
              <select
                defaultValue="medium"
                disabled
                className="rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text outline-none"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
              <span className="ml-3 text-xs text-text-subtle italic">
                Coming soon
              </span>
            </div>
          </section>

          {/* Notifications */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-text">Notifications</h2>
            <p className="mt-1 text-sm text-text-muted">
              Email reminders for interviews, deadlines, and follow-ups
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-text">Email notifications</span>
              <span className="rounded-md bg-bg px-3 py-1 text-xs text-text-subtle">
                Coming soon
              </span>
            </div>
          </section>

          {/* Auto-Archive */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-text">Auto-Archive</h2>
            <p className="mt-1 text-sm text-text-muted">
              Automatically archive applications with no updates after a set
              number of days
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm text-text">
                Auto-archive after inactivity
              </span>
              <span className="rounded-md bg-bg px-3 py-1 text-xs text-text-subtle">
                Coming soon
              </span>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
            <h2 className="text-lg font-semibold text-text">
              Keyboard Shortcuts
            </h2>
            <div className="mt-4 space-y-2">
              {[
                ["N", "Create a new card"],
                ["F", "Focus the search bar"],
                ["↑ ↓ ← →", "Navigate between cards"],
                ["E", "Open focused card"],
                ["S", "Quick status change"],
                ["Esc", "Close any modal"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">{desc}</span>
                  <kbd className="rounded border border-border bg-bg px-2 py-0.5 text-xs font-mono text-text">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs text-text-subtle italic">
              Shortcuts not yet active — reference only
            </p>
          </section>
        </div>
      </main>
    </>
  );
}