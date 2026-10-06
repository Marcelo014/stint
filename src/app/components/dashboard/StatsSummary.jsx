"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatPercent } from "@/app/components/stats/Section";

/**
 * Compact stat row above the card grid.
 *
 * `refreshKey` changes whenever the dashboard mutates a card, which refetches
 * the summary — the numbers span archived rows and status history, so they
 * can't be derived from the page of cards on screen.
 */
export default function StatsSummary({ refreshKey }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/stats?view=summary");
        const data = await res.json();
        if (!cancelled && res.ok) setSummary(data.summary);
      } catch (err) {
        console.error("Failed to load stats summary:", err);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const tiles = [
    { label: "Total", value: summary?.total },
    { label: "Active", value: summary?.active },
    { label: "In interviews", value: summary?.in_interviews },
    { label: "Offers", value: summary?.offers },
    {
      label: "Response rate",
      value: summary ? formatPercent(summary.response_rate) : undefined,
    },
  ];

  return (
    <div className="mt-6 rounded-xl border border-border bg-card px-4 py-3">
      {/* A grid at 375px (three up, wrapping) instead of a flex row that would
          squeeze "Response rate" off the edge; a plain row from sm up. */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-8">
        {tiles.map((tile) => (
          <div key={tile.label} className="min-w-0">
            <p className="text-xs text-text-subtle">{tile.label}</p>
            {tile.value === undefined ? (
              <div className="mt-1 h-5 w-8 animate-pulse rounded bg-bg" />
            ) : (
              <p className="text-lg font-semibold tabular-nums leading-6 text-text">
                {tile.value}
              </p>
            )}
          </div>
        ))}
        <Link
          href="/stats"
          className="col-span-3 flex min-h-11 items-center text-xs font-medium text-accent transition hover:text-accent-hover sm:col-auto sm:ml-auto"
        >
          Full stats →
        </Link>
      </div>
    </div>
  );
}
