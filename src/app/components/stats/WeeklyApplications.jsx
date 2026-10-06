"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** "2026-03-02" -> "Mar 2" */
function formatWeek(week) {
  const [y, m, d] = week.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const AXIS_TICK = { fill: "var(--color-text-subtle)", fontSize: 11 };

function WeekTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { week, count } = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs text-text-muted">Week of {formatWeek(week)}</p>
      <p className="text-sm font-semibold text-text">
        {count} application{count !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default function WeeklyApplications({ weekly }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={weekly} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--color-border)"
          strokeDasharray="2 4"
        />
        <XAxis
          dataKey="week"
          tickFormatter={formatWeek}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--color-border)" }}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip
          content={<WeekTooltip />}
          cursor={{ fill: "var(--color-card-hover)" }}
        />
        <Bar
          dataKey="count"
          fill="var(--color-accent)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
