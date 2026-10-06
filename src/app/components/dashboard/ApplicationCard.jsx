"use client";

import { useState, useRef, useEffect } from "react";

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
    active: "bg-accent text-white",
    inactive: "bg-card-hover text-text-subtle",
  },
  clock: {
    icon: "⏱",
    label: "Follow up",
    active: "bg-status-oa text-white",
    inactive: "bg-card-hover text-text-subtle",
  },
};

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function todayISO() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function ApplicationCard({
  application,
  statuses,
  onStatusChange,
  onClick,
  onArchivedChange,
}) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [markers, setMarkers] = useState(application.card_markers || []);
  const statusRef = useRef(null);

  const status = application.statuses;
  const dateStr = formatDate(application.date_applied);

  const archived = application.is_archived === true;

  const rounds = application.interview_rounds || [];
  const completedRounds = rounds.filter((r) => r.is_completed).length;
  const progressPct = rounds.length ? (completedRounds / rounds.length) * 100 : 0;

  // Earliest not-yet-completed round dated today or later.
  const today = todayISO();
  const nextRound = rounds
    .filter((r) => !r.is_completed && r.scheduled_date && r.scheduled_date >= today)
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))[0];

  useEffect(() => {
    if (!showStatusDropdown) return;
    function handleClick(e) {
      if (statusRef.current && !statusRef.current.contains(e.target)) {
        setShowStatusDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showStatusDropdown]);

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
      onClick={handleCardClick}
      className={`relative cursor-pointer rounded-xl p-5 transition hover:border-accent/40 hover:shadow-sm ${
        archived
          ? "border border-dashed border-border bg-bg opacity-80"
          : "border border-border bg-card"
      }`}
    >
      {archived && (
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-full bg-card-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
            Archived
          </span>
          <button
            data-stop-nav
            onClick={() => onArchivedChange(application.id, false)}
            className="text-xs font-medium text-accent transition hover:text-accent-hover"
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
      <div className="mt-3 flex items-center gap-2">
        <div className="relative" ref={statusRef} data-stop-nav>
          <button
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition hover:bg-card-hover"
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: status?.color_hex || "#9C9286" }}
            />
            <span className="text-text-muted">{status?.name || "No status"}</span>
          </button>

          {showStatusDropdown && (
            <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
              {statuses.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    onStatusChange(application.id, s.id);
                    setShowStatusDropdown(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-muted transition hover:bg-card-hover"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: s.color_hex }}
                  />
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition hover:opacity-80 ${
                active ? config.active : config.inactive
              }`}
            >
              {config.icon}
            </button>
          );
        })}
      </div>

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
          Next interview: {formatDate(nextRound.scheduled_date)}
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
    </div>
  );
}
