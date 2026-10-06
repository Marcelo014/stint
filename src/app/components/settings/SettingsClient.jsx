"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Navbar from "@/app/components/Navbar";
import ProfileSection from "./ProfileSection";
import NotificationsSection from "./NotificationsSection";
import AutoArchiveSection from "./AutoArchiveSection";

const DEFAULT_NEW_COLOR = "#7A8C5E";

export default function SettingsClient() {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_NEW_COLOR);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const savedTimeout = useRef(null);

  // include_hidden so hidden statuses can still be managed here
  useEffect(() => {
    fetch("/api/statuses?include_hidden=true")
      .then((r) => r.json())
      .then((d) => {
        setStatuses(d.statuses || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimeout.current) clearTimeout(savedTimeout.current);
    };
  }, []);

  // Same transient Saving.../Saved indicator as the detail page.
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

  const patchStatus = useCallback(
    (id, updates) =>
      withSaveIndicator(async () => {
        const res = await fetch(`/api/statuses/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setStatuses((prev) => prev.map((s) => (s.id === id ? data.status : s)));
      }),
    [withSaveIndicator]
  );

  // Sends the full ordered id list, so sort_order is renumbered 0..n with
  // no chance of colliding with rows left out of the request.
  function moveStatus(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= statuses.length) return;

    const reordered = [...statuses];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setStatuses(reordered);

    withSaveIndicator(async () => {
      const res = await fetch("/api/statuses/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: reordered.map((s) => s.id) }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      setStatuses(data.statuses);
    });
  }

  async function createStatus() {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    setCreateError("");
    try {
      const res = await fetch("/api/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color_hex: newColor }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatuses((prev) => [...prev, data.status]);
        setNewName("");
        setNewColor(DEFAULT_NEW_COLOR);
      } else {
        setCreateError(data.error || "Could not create status");
      }
    } catch (err) {
      console.error("Create status failed:", err);
      setCreateError("Could not create status");
    } finally {
      setCreating(false);
    }
  }

  async function deleteStatus(id) {
    try {
      const res = await fetch(`/api/statuses/${id}`, { method: "DELETE" });
      if (res.ok) setStatuses((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Delete status failed:", err);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg px-6 py-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-semibold tracking-tight text-text">
            Settings
          </h1>

          <ProfileSection />

          {/* Status Management */}
          <section className="mt-6 rounded-xl border border-border bg-card p-6">
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
                {statuses.map((s, i) => (
                  <StatusRow
                    key={s.id}
                    status={s}
                    isFirst={i === 0}
                    isLast={i === statuses.length - 1}
                    onPatch={patchStatus}
                    onMoveUp={() => moveStatus(i, -1)}
                    onMoveDown={() => moveStatus(i, 1)}
                    onDelete={() => deleteStatus(s.id)}
                  />
                ))}
              </div>
            )}

            {/* New status */}
            <div className="mt-5 border-t border-border pt-5">
              <label className="mb-2 block text-sm font-medium text-text-muted">
                New status
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="color"
                  value={newColor}
                  onChange={(e) => setNewColor(e.target.value)}
                  aria-label="New status color"
                  className="h-9 w-10 cursor-pointer rounded-md border border-border bg-bg p-1"
                />
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Take-home"
                  className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder-text-subtle outline-none transition focus:border-accent"
                />
                <button
                  onClick={createStatus}
                  disabled={creating || !newName.trim()}
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-hover disabled:opacity-50"
                >
                  {creating ? "Adding..." : "Add status"}
                </button>
              </div>
              {createError && (
                <p className="mt-2 text-xs text-status-rejected">{createError}</p>
              )}
            </div>

            <p
              className={`mt-4 text-sm text-accent transition-opacity duration-500 ${
                saving || showSaved ? "opacity-100" : "opacity-0"
              }`}
            >
              {saving ? "Saving..." : "\u2713 Saved"}
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

          <NotificationsSection />

          <AutoArchiveSection />

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

function StatusRow({ status, isFirst, isLast, onPatch, onMoveUp, onMoveDown, onDelete }) {
  const [name, setName] = useState(status.name);
  const [color, setColor] = useState(status.color_hex);
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

  function saveName() {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(status.name);
      return;
    }
    if (trimmed !== status.name) onPatch(status.id, { name: trimmed });
  }

  function saveColor() {
    if (color !== status.color_hex) onPatch(status.id, { color_hex: color });
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
  }

  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-lg bg-bg px-4 py-2.5 ${
        status.is_hidden ? "opacity-60" : ""
      }`}
    >
      {/* Reorder */}
      <div className="flex flex-col">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label={`Move ${status.name} up`}
          className="text-xs leading-none text-text-subtle transition hover:text-text disabled:opacity-30"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          aria-label={`Move ${status.name} down`}
          className="mt-0.5 text-xs leading-none text-text-subtle transition hover:text-text disabled:opacity-30"
        >
          ▼
        </button>
      </div>

      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        onBlur={saveColor}
        aria-label={`${status.name} color`}
        className="h-8 w-9 cursor-pointer rounded-md border border-border bg-card p-1"
      />

      {/* Presets keep their names; only custom statuses can be renamed */}
      {status.is_preset ? (
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">
          {status.name}
        </span>
      ) : (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          aria-label="Status name"
          className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-text outline-none transition hover:border-border focus:border-accent"
        />
      )}

      {status.is_hidden && (
        <span className="rounded-full bg-card-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
          Hidden
        </span>
      )}

      <span className="text-xs text-text-subtle">
        {status.is_preset ? "Preset" : "Custom"}
      </span>

      <button
        onClick={() => onPatch(status.id, { is_hidden: !status.is_hidden })}
        className="text-xs font-medium text-accent transition hover:text-accent-hover"
      >
        {status.is_hidden ? "Show" : "Hide"}
      </button>

      {/* Presets can only be hidden, so no delete control for them */}
      {!status.is_preset &&
        (!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-text-subtle transition hover:text-status-rejected"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted">
              Delete? Its applications move to Applied.
            </span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md bg-status-rejected px-2.5 py-1 text-xs font-medium text-white transition hover:bg-status-rejected/80 disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Yes"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-text-muted transition hover:text-text"
            >
              Cancel
            </button>
          </div>
        ))}
    </div>
  );
}
