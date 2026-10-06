"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPercent } from "./Section";

/**
 * Stage fills: one hue (accent), light to dark as the funnel narrows — the
 * sequential ramp for an ordinal magnitude. Opacity rather than five new
 * tokens, so it tracks the accent in both themes.
 */
const STAGE_OPACITY = [0.4, 0.55, 0.7, 0.85, 1];

export default function StatsFunnel({ funnel }) {
  const [expanded, setExpanded] = useState(null);

  // Every stage is drawn relative to Applied, so the widths read as a funnel
  // rather than each row re-normalising to its own max.
  const widest = funnel[0]?.count || 0;

  return (
    <div className="space-y-2">
      {funnel.map((stage, i) => {
        const isOpen = expanded === stage.key;
        const widthPercent = widest > 0 ? (stage.count / widest) * 100 : 0;

        return (
          <div key={stage.key}>
            <button
              onClick={() => setExpanded(isOpen ? null : stage.key)}
              aria-expanded={isOpen}
              disabled={stage.count === 0}
              className="group min-h-11 w-full rounded-lg px-2 py-2 text-left transition hover:bg-card-hover disabled:cursor-default disabled:hover:bg-transparent"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-text">
                  {stage.label}
                </span>
                <span className="flex items-baseline gap-2 text-xs">
                  <span className="font-semibold text-text">{stage.count}</span>
                  <span className="text-text-subtle">
                    {widest > 0 ? formatPercent(stage.count / widest) : "—"}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`text-text-subtle transition-transform ${
                      isOpen ? "rotate-90" : ""
                    } ${stage.count === 0 ? "opacity-0" : ""}`}
                  >
                    ›
                  </span>
                </span>
              </div>
              {/* Track keeps the funnel's shape legible when a stage is 0 */}
              <div className="mt-1.5 h-7 w-full overflow-hidden rounded-md bg-bg">
                <div
                  className="h-full rounded-md bg-accent transition-all"
                  style={{
                    width: `${widthPercent}%`,
                    opacity: STAGE_OPACITY[i] ?? 1,
                  }}
                />
              </div>
            </button>

            {isOpen && <StageList applications={stage.applications} />}
          </div>
        );
      })}
    </div>
  );
}

function StageList({ applications }) {
  return (
    <ul className="mb-2 ml-2 mt-1 max-h-72 space-y-1 overflow-y-auto border-l border-border pl-3">
      {applications.map((app) => (
        <li key={app.id}>
          <Link
            href={`/applications/${app.id}`}
            className="flex min-h-11 items-center gap-2 rounded-md px-2 transition hover:bg-card-hover"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: app.status_color || "var(--color-text-subtle)" }}
            />
            <span className="truncate text-sm text-text">{app.company_name}</span>
            <span className="truncate text-xs text-text-muted">
              {app.job_title}
            </span>
            <span className="ml-auto shrink-0 text-xs text-text-subtle">
              {app.status_name || "No status"}
              {app.is_archived && " · archived"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
