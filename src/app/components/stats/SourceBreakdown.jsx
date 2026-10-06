"use client";

import { formatPercent } from "./Section";

/**
 * Applications and response rate are different scales, so they get their own
 * columns rather than being crammed onto one pair of axes. The inline bar
 * encodes the rate only.
 */
export default function SourceBreakdown({ sources }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 pr-3 font-medium text-text-subtle">Source</th>
            <th className="pb-2 pr-3 text-right font-medium text-text-subtle">
              Applications
            </th>
            <th className="pb-2 font-medium text-text-subtle">Response rate</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((row) => (
            <tr key={row.source ?? "__none__"} className="border-b border-border/60">
              <td className="py-2.5 pr-3 text-text">
                {row.source ?? (
                  <span className="text-text-subtle">Not recorded</span>
                )}
              </td>
              <td className="py-2.5 pr-3 text-right tabular-nums text-text">
                {row.total}
              </td>
              <td className="py-2.5">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-bg">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${row.response_rate * 100}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-xs text-text-muted">
                    {formatPercent(row.response_rate)}
                  </span>
                  <span className="text-xs text-text-subtle">
                    ({row.responded}/{row.total})
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
