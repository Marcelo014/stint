"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/app/components/Navbar";
import Section, { formatPercent } from "./Section";
import StatsFunnel from "./StatsFunnel";
import WeeklyApplications from "./WeeklyApplications";
import StatusDurations from "./StatusDurations";
import SourceBreakdown from "./SourceBreakdown";

export default function StatsClient() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        if (cancelled) return;
        if (res.ok) setStats(data);
        else setError(true);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-bg px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <header>
            <h1 className="text-2xl font-semibold tracking-tight text-text">
              Your stats
            </h1>
            <p className="mt-1 text-sm text-text-muted">
              Every application you&apos;ve tracked, archived ones included.
            </p>
          </header>

          {error ? (
            <p className="mt-12 text-sm text-text-muted">
              Couldn&apos;t load your stats. Try reloading the page.
            </p>
          ) : !stats ? (
            <Skeleton />
          ) : stats.summary.total === 0 ? (
            <NoApplicationsYet />
          ) : (
            <div className="mt-8 space-y-5">
              <Section
                title="Funnel"
                caption="Each application is counted in every stage it reached."
              >
                <StatsFunnel funnel={stats.funnel} />
                <p className="mt-3 px-2 text-xs text-text-subtle">
                  Select a stage to list its applications.
                </p>
              </Section>

              <Section
                title="Applications per week"
                caption={
                  stats.weekly_truncated
                    ? "By the week you applied — last 26 weeks."
                    : "By the week you applied."
                }
                isEmpty={stats.weekly.length === 0}
                emptyText="No application dates recorded yet."
              >
                <WeeklyApplications weekly={stats.weekly} />
              </Section>

              <Section
                title="Average days in each status"
                caption="Counts the time cards are still sitting in their current status."
                isEmpty={stats.status_durations.length === 0}
                emptyText="No status history yet — this fills in as you move cards along."
              >
                <StatusDurations durations={stats.status_durations} />
              </Section>

              <Section
                title="By source"
                caption="Where your applications came from, and how often each one got a reply."
                isEmpty={stats.sources.length === 0}
                emptyText="No sources recorded yet."
              >
                <SourceBreakdown sources={stats.sources} />
              </Section>

              <p className="px-1 text-xs text-text-subtle">
                A reply counts as any move off Applied other than Ghosted or
                Withdrawn. Overall response rate:{" "}
                <span className="text-text-muted">
                  {formatPercent(stats.summary.response_rate)}
                </span>
              </p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function Skeleton() {
  return (
    <div className="mt-8 space-y-5">
      {[280, 240, 220, 180].map((h, i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl border border-border bg-card"
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

function NoApplicationsYet() {
  return (
    <div className="mt-20 text-center">
      <p className="text-lg font-medium text-text">Nothing to chart yet</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-muted">
        Your funnel, weekly pace and response rates show up here once you&apos;ve
        tracked your first application.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition hover:bg-accent-hover"
      >
        Add your first application
      </Link>
    </div>
  );
}
