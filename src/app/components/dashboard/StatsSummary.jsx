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
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        {tiles.map((tile) => (
          <div key={tile.label}>
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
          className="ml-auto text-xs font-medium text-accent transition hover:text-accent-hover"
        >
          Full stats →
        </Link>
      </div>
    </div>
  );
}
