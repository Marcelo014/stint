"use client";

import { useEffect, useRef, useState } from "react";
import QuickReminder from "./QuickReminder";
import HiredCelebration from "@/app/components/HiredCelebration";
import { DEADLINE_TONE_CLASS, deadlineWarning } from "@/lib/deadline";

const MARKERS = {
  exclamation: {
    icon: "!",
    label: "Urgent",
    active: "bg-status-rejected text-white",
    inactive: "bg-card-hover text-text-subtle",
  },
  star: {
    icon: "★",
    label: "Favorite",
    active: "bg-status-applied text-white",
    inactive: "bg-card-hover text-text-subtle",
  },
  pin: {
    icon: "📌",
    label: "Pinned",
    active: "bg-accent text-accent-fg",
    inactive: "bg-card-hover text-text-subtle",
  },
  clock: {
    icon: "⏱",
    label: "Follow up",
    active: "bg-status-oa text-white",
    inactive: "bg-card-hover text-text-subtle",
  },
};

/** date_applied and deadline are plain dates — parse as local midnight. */
function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * scheduled_date is TIMESTAMPTZ, so it's formatted in the browser's zone and
 * shows the time. Rendering it as a bare date in UTC would put an evening
 * US-Eastern interview on the wrong day.
 */
function formatDateTime(value) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ApplicationCard({
  application,
  statuses,
  onStatusChange,
  onClick,
  onArchivedChange,
  // Resolved size — the card's own card_size, else the profile default.
  size = "medium",
  // Keyboard focus lives in the parent so the arrow keys can move it between
  // cards; the card only renders the ring and scrolls itself into view.
  isFocused = false,
  // The status dropdown is controlled for the same reason: S has to be able
  // to open it on whichever card currently holds focus.
  statusOpen = false,
  onStatusOpenChange,
  celebrate = false,
  onCelebrationDone,
}) {
  const [markers, setMarkers] = useState(application.card_markers || []);
  const statusRef = useRef(null);
  const cardRef = useRef(null);
  const dropdownRef = useRef(null);

  const status = application.statuses;
  const dateStr = formatDate(application.date_applied);

  const archived = application.is_archived === true;
  // archived_reason is 'auto' when the daily job did it, 'manual' otherwise.
  const autoArchived = archived && application.archived_reason === "auto";

  const showDetails = size !== "small";
  const showExtras = size === "large";

  const rounds = application.interview_rounds || [];
  const completedRounds = rounds.filter((r) => r.is_completed).length;
  const progressPct = rounds.length ? (completedRounds / rounds.length) * 100 : 0;

  // Earliest not-yet-completed round still ahead of us. Compared as instants,
  // since scheduled_date is a timestamp rather than a date.
  //
  // The clock is read once per mount rather than on every render: reading it
  // during render is impure (React Compiler rejects it), and a card's notion
  // of "upcoming" shouldn't quietly shift as unrelated state changes.
  const [nowMs] = useState(() => Date.now());
  const nextRound = rounds
    .filter(
      (r) =>
        !r.is_completed &&
        r.scheduled_date &&
        Date.parse(r.scheduled_date) >= nowMs
    )
    .sort((a, b) => Date.parse(a.scheduled_date) - Date.parse(b.scheduled_date))[0];

  // Shown at every size: a deadline closing in is time-critical, not a detail.
  const deadline = deadlineWarning({
    deadline: application.deadline,
    isArchived: archived,
    status,
    nowMs,
  });

  useEffect(() => {
    if (!statusOpen) return;
    function handleClick(e) {
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        onStatusOpenChange?.(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [statusOpen, onStatusOpenChange]);

  // Opening via the S shortcut leaves the keyboard inside the menu, so the
  // arrow keys and Enter pick a status without reaching for the mouse.
  useEffect(() => {
    if (!statusOpen) return;
    dropdownRef.current?.querySelector("button")?.focus();
  }, [statusOpen]);

  // Arrowing off the bottom of the viewport should bring the card to you.
  useEffect(() => {
    if (!isFocused) return;
    cardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [isFocused]);

  // The whole card is clickable, but anything inside a [data-stop-nav]
  // region is an in-card control and must not navigate. Checking the real
  // DOM ancestry is reliable where stopPropagation is easy to get wrong.
  function handleCardClick(e) {
    if (e.target.closest("[data-stop-nav]")) return;
    onClick();
  }

  async function toggleMarker(markerType) {
    setMarkers((prev) => {
      const exists = prev.some((m) => m.marker_type === markerType);
      if (exists) return prev.filter((m) => m.marker_type !== markerType);
      return [...prev, { marker_type: markerType }];
    });

    try {
      const res = await fetch(`/api/applications/${application.id}/markers`, {
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

  return (
    <div
      ref={cardRef}
      onClick={handleCardClick}
      data-card-focused={isFocused ? "true" : undefined}
      className={`relative cursor-pointer rounded-xl transition hover:border-accent/40 hover:shadow-sm ${
        size === "small" ? "p-4" : "p-5"
      } ${
        archived
          ? "border border-dashed border-border bg-bg opacity-80"
          : "border border-border bg-card"
      } ${
        isFocused
          ? "ring-2 ring-accent ring-offset-2 ring-offset-bg border-accent/60"
          : ""
      }`}
    >
      {archived && (
        <div className="mb-3 flex items-center gap-2">
          <span
            className="rounded-full bg-card-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle"
            title={
              autoArchived
                ? "Archived automatically after a spell of no activity"
                : "You archived this"
            }
          >
            {autoArchived ? "Auto-archived" : "Archived"}
          </span>
          <button
            data-stop-nav
            onClick={() => onArchivedChange(application.id, false)}
            className="px-1 py-1 text-xs font-medium text-accent transition hover:text-accent-hover"
          >
            Restore
          </button>
        </div>
      )}
      {/* Company · Job Title — the keyboard-reachable way into the card */}
      <div className="min-w-0">
        <button
          data-stop-nav
          onClick={onClick}
          className="block w-full truncate text-left text-sm font-semibold text-text outline-none focus-visible:underline focus-visible:decoration-accent focus-visible:decoration-2 focus-visible:underline-offset-2"
        >
          {application.company_name}
          <span className="mx-1.5 text-text-subtle">·</span>
          {application.job_title}
        </button>
      </div>

      {/* Status picker */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="relative" ref={statusRef} data-stop-nav>
          <button
            onClick={() => onStatusOpenChange?.(!statusOpen)}
            aria-expanded={statusOpen}
            aria-haspopup="menu"
            className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1 text-xs transition hover:bg-card-hover"
          >
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: status?.color_hex || "#9C9286" }}
            />
            <span className="text-text-muted">{status?.name || "No status"}</span>
          </button>

          <HiredCelebration active={celebrate} onDone={onCelebrationDone} />

          {statusOpen && (
            <div
              ref={dropdownRef}
              role="menu"
              className="absolute left-0 top-full z-10 mt-1 max-h-64 w-44 overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-lg"
            >
              {statuses.map((s) => (
                <button
                  key={s.id}
                  role="menuitem"
                  onClick={() => {
                    onStatusChange(application.id, s.id);
                    onStatusOpenChange?.(false);
                  }}
                  className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text-muted transition hover:bg-card-hover focus-visible:bg-card-hover focus-visible:outline-none"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: s.color_hex }}
                  />
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {deadline && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              DEADLINE_TONE_CLASS[deadline.tone]
            }`}
            title={`Deadline ${formatDate(application.deadline)}`}
          >
            {deadline.label}
          </span>
        )}
      </div>

      {showDetails && (
        <>
          {/* Marker pills — inline toggles, same styling as the detail page */}
          <div className="mt-3 flex items-center gap-1.5" data-stop-nav>
            {Object.entries(MARKERS).map(([type, config]) => {
              const active = markers.some((m) => m.marker_type === type);
              return (
                <button
                  key={type}
                  onClick={() => toggleMarker(type)}
                  aria-pressed={active}
                  aria-label={config.label}
                  title={config.label}
                  className={`min-h-9 min-w-9 rounded-full px-2.5 py-1 text-xs font-medium transition hover:opacity-80 ${
                    active ? config.active : config.inactive
                  }`}
                >
                  {config.icon}
                </button>
              );
            })}
          </div>

          {/* Quick reminder — archived cards are out of the search, so no nudges */}
          {!archived && (
            <div className="mt-2">
              <QuickReminder applicationId={application.id} />
            </div>
          )}

          {/* Round progress — hidden entirely when there are no rounds */}
          {rounds.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-text-subtle">
                {completedRounds} of {rounds.length} round
                {rounds.length !== 1 ? "s" : ""} complete
              </p>
              <div
                role="progressbar"
                aria-valuenow={completedRounds}
                aria-valuemin={0}
                aria-valuemax={rounds.length}
                aria-label="Interview rounds completed"
                className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-card-hover"
              >
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {nextRound && (
            <p className="mt-2 text-xs text-text-muted">
              Next interview: {formatDateTime(nextRound.scheduled_date)}
            </p>
          )}

          {/* Date applied */}
          <p className="mt-3 text-xs text-text-subtle">Applied {dateStr}</p>

          {application.salary && (
            <p className="mt-1 text-xs text-text-subtle">{application.salary}</p>
          )}
          {application.source && (
            <p className="mt-1 text-xs text-text-subtle">via {application.source}</p>
          )}
        </>
      )}

      {/* Large only: the fields worth a second glance without opening the card */}
      {showExtras && (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          {application.deadline && (
            <p className="text-xs text-text-subtle">
              Deadline {formatDate(application.deadline)}
            </p>
          )}
          {(application.recruiter_name || application.recruiter_email) && (
            <p className="truncate text-xs text-text-subtle">
              Recruiter: {application.recruiter_name || application.recruiter_email}
            </p>
          )}
          {application.notes && (
            <p className="line-clamp-3 whitespace-pre-line text-xs text-text-muted">
              {application.notes}
            </p>
          )}
          {!application.deadline &&
            !application.recruiter_name &&
            !application.recruiter_email &&
            !application.notes && (
              <p className="text-xs text-text-subtle italic">
                No notes, recruiter or deadline yet
              </p>
            )}
        </div>
      )}
    </div>
  );
}
