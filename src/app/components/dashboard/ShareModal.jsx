"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SHARE_FIELDS } from "@/lib/shareFields";

/**
 * Share-card controls: per-field toggles, copy, regenerate, disable.
 *
 * The share row is created lazily on first open, so a user who never opens
 * this modal never has a public_shares row at all.
 */
export default function ShareModal({ onClose }) {
  const [share, setShare] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);
  const copiedTimeout = useRef(null);

  const shareUrl = share ? `${window.location.origin}/share/${share.share_id}` : "";

  useEffect(() => {
    let cancelled = false;

    // POST is idempotent — it returns the existing row if there is one.
    fetch("/api/shares", { method: "POST" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.share) setShare(d.share);
        else setLoadFailed(true);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Escape closes the modal, or backs out of the regenerate confirm first.
  useEffect(() => {
    function handleKey(e) {
      if (e.key !== "Escape") return;
      if (confirmRegenerate) setConfirmRegenerate(false);
      else onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [confirmRegenerate, onClose]);

  useEffect(() => {
    return () => {
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
    };
  }, []);

  const patch = useCallback(async (updates) => {
    setSaving(true);
    try {
      const res = await fetch("/api/shares", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) return;
      const data = await res.json();
      setShare(data.share);
    } catch (err) {
      console.error("Share update failed:", err);
    } finally {
      setSaving(false);
    }
  }, []);

  async function regenerate() {
    setConfirmRegenerate(false);
    setSaving(true);
    try {
      const res = await fetch("/api/shares/regenerate", { method: "POST" });
      if (!res.ok) return;
      const data = await res.json();
      setShare(data.share);
      setCopied(false);
    } catch (err) {
      console.error("Regenerate failed:", err);
    } finally {
      setSaving(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
      copiedTimeout.current = setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/30 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Share your stats"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Share your stats</h2>
            <p className="mt-1 text-sm text-text-muted">
              A read-only card at an unguessable link. You choose what&apos;s on it.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center text-text-subtle transition hover:text-text"
          >
            ✕
          </button>
        </div>

        {loadFailed ? (
          <p className="mt-5 text-sm text-text-muted">
            Couldn&apos;t load your share settings. Try again.
          </p>
        ) : !share ? (
          <div className="mt-5 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-bg" />
            ))}
          </div>
        ) : (
          <>
            {/* Link */}
            <div className="mt-5">
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Your link
              </label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className={`min-h-11 min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 text-xs outline-none ${
                    share.is_enabled ? "text-text" : "text-text-subtle line-through"
                  }`}
                />
                <button
                  onClick={copyLink}
                  disabled={!share.is_enabled}
                  className="min-h-11 shrink-0 rounded-lg bg-accent px-4 text-xs font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              {!share.is_enabled && (
                <p className="mt-1.5 text-xs text-text-subtle">
                  Sharing is off — this link returns a 404.
                </p>
              )}
            </div>

            {/* Toggles */}
            <div
              className={`mt-5 border-t border-border pt-4 ${
                share.is_enabled ? "" : "opacity-50"
              }`}
            >
              <p className="mb-2 text-xs font-medium text-text-muted">
                What&apos;s on the card
              </p>
              <div className="space-y-1">
                {SHARE_FIELDS.map((field) => (
                  <label
                    key={field.column}
                    className="flex min-h-11 cursor-pointer items-center justify-between rounded-lg px-2 transition hover:bg-bg"
                  >
                    <span className="text-sm text-text">{field.label}</span>
                    <input
                      type="checkbox"
                      checked={share[field.column] === true}
                      disabled={!share.is_enabled || saving}
                      onChange={(e) => patch({ [field.column]: e.target.checked })}
                      className="h-5 w-5 rounded border-border accent-accent"
                    />
                  </label>
                ))}
              </div>
              <p className="mt-2 px-2 text-xs text-text-subtle">
                Anything switched off is left out of the response entirely.
              </p>
            </div>

            {/* Destructive controls */}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <button
                onClick={() => patch({ is_enabled: !share.is_enabled })}
                disabled={saving}
                className="min-h-11 rounded-lg border border-border bg-bg px-3 text-xs font-medium text-text-muted transition hover:border-accent hover:text-text disabled:opacity-50"
              >
                {share.is_enabled ? "Disable sharing" : "Enable sharing"}
              </button>

              {!confirmRegenerate ? (
                <button
                  onClick={() => setConfirmRegenerate(true)}
                  disabled={saving}
                  className="text-xs text-text-subtle transition hover:text-status-rejected disabled:opacity-50"
                >
                  Regenerate link
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">
                    Breaks the old link. Sure?
                  </span>
                  <button
                    onClick={regenerate}
                    className="rounded-md bg-status-rejected px-2.5 py-1 text-xs font-medium text-white transition hover:bg-status-rejected/80"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmRegenerate(false)}
                    className="text-xs text-text-muted transition hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-xs font-medium text-accent transition hover:text-accent-hover"
              >
                Preview →
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
