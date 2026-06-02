"use client";

import { useState, useRef, useEffect } from "react";

export default function ApplicationCard({ application, statuses, onStatusChange, onClick }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const status = application.statuses;
  const dateStr = new Date(application.date_applied + "T00:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric", year: "numeric" }
  );

  useEffect(() => {
    if (!showDropdown) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showDropdown]);

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-border bg-card p-5 transition hover:border-accent/40 hover:shadow-sm"
    >
      {/* Company · Job Title */}
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-text">
          {application.company_name}
          <span className="mx-1.5 text-text-subtle">·</span>
          {application.job_title}
        </p>
      </div>

      {/* Status dot + dropdown */}
      <div
        className="relative mt-3"
        ref={dropdownRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-xs transition hover:bg-card-hover"
        >
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: status?.color_hex || "#9C9286" }}
          />
          <span className="text-text-muted">{status?.name || "No status"}</span>
        </button>

        {showDropdown && (
          <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg">
            {statuses.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  onStatusChange(application.id, s.id);
                  setShowDropdown(false);
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

      {/* Date applied */}
      <p className="mt-3 text-xs text-text-subtle">Applied {dateStr}</p>

      {/* Optional fields */}
      {application.salary && (
        <p className="mt-1 text-xs text-text-subtle">{application.salary}</p>
      )}
      {application.source && (
        <p className="mt-1 text-xs text-text-subtle">via {application.source}</p>
      )}
    </div>
  );
}