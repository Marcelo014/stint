"use client";

import { useState, useRef, useEffect } from "react";

const MARKERS = {
  exclamation: { icon: "!", label: "Urgent", active: "bg-status-rejected text-white" },
  star: { icon: "★", label: "Favorite", active: "bg-status-applied text-white" },
  pin: { icon: "📌", label: "Pinned", active: "bg-accent text-white" },
  clock: { icon: "⏱", label: "Follow up", active: "bg-status-oa text-white" },
};

export default function ApplicationCard({ application, statuses, onStatusChange, onClick }) {
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showMarkerDropdown, setShowMarkerDropdown] = useState(false);
  const [markers, setMarkers] = useState(application.card_markers || []);
  const statusRef = useRef(null);
  const markerRef = useRef(null);

  const status = application.statuses;
  const dateStr = new Date(application.date_applied + "T00:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  useEffect(() => {
    if (!showStatusDropdown && !showMarkerDropdown) return;
    function handleClick(e) {
      if (showStatusDropdown && statusRef.current && !statusRef.current.contains(e.target)) {
        setShowStatusDropdown(false);
      }
      if (showMarkerDropdown && markerRef.current && !markerRef.current.contains(e.target)) {
        setShowMarkerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showStatusDropdown, showMarkerDropdown]);

  async function toggleMarker(e, markerType) {
    e.stopPropagation();
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
      onClick={onClick}
      className="relative cursor-pointer rounded-xl border border-border bg-card p-5 transition hover:border-accent/40 hover:shadow-sm"
    >
      {/* Markers — top right corner */}
      {markers.length > 0 && (
        <div className="absolute right-3 top-3 flex items-center gap-1">
          {markers.map((m) => {
            const config = MARKERS[m.marker_type];
            if (!config) return null;
            return (
              <span
                key={m.marker_type}
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${config.active}`}
                title={config.label}
              >
                {config.icon}
              </span>
            );
          })}
        </div>
      )}

      {/* Company · Job Title */}
      <div className="min-w-0 pr-16">
        <p className="truncate text-sm font-semibold text-text">
          {application.company_name}
          <span className="mx-1.5 text-text-subtle">·</span>
          {application.job_title}
        </p>
      </div>

      {/* Status + Marker dropdowns row */}
      <div className="mt-3 flex items-center gap-2">
        {/* Status dropdown */}
        <div
          className="relative"
          ref={statusRef}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              setShowStatusDropdown(!showStatusDropdown);
              setShowMarkerDropdown(false);
            }}
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

        {/* Marker dropdown */}
        <div
          className="relative"
          ref={markerRef}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMarkerDropdown(!showMarkerDropdown);
              setShowStatusDropdown(false);
            }}
            className="rounded-md px-2 py-1 text-xs text-text-subtle transition hover:bg-card-hover"
          >
            🏷
          </button>

          {showMarkerDropdown && (
            <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
              {Object.entries(MARKERS).map(([type, config]) => {
                const active = markers.some((m) => m.marker_type === type);
                return (
                  <button
                    key={type}
                    onClick={(e) => toggleMarker(e, type)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text-muted transition hover:bg-card-hover"
                  >
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                        active ? config.active : "bg-card-hover text-text-subtle"
                      }`}
                    >
                      {config.icon}
                    </span>
                    <span>{config.label}</span>
                    {active && <span className="ml-auto text-accent">✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

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