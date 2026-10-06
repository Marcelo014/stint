"use client";

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const AXIS_TICK = { fill: "var(--color-text-subtle)", fontSize: 11 };

function DurationTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs text-text-muted">{row.name}</p>
      <p className="text-sm font-semibold text-text">
        {row.avg_days} day{row.avg_days !== 1 ? "s" : ""} on average
      </p>
      <p className="mt-0.5 text-xs text-text-subtle">
        across {row.spans} stint{row.spans !== 1 ? "s" : ""}
      </p>
    </div>
  );
}

export default function StatusDurations({ durations }) {
  // Horizontal bars: status names are long, and reading them down the left
  // edge beats rotating them under a vertical chart.
  const height = Math.max(160, durations.length * 36 + 32);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={durations}
        layout="vertical"
        margin={{ top: 0, right: 40, bottom: 0, left: 8 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={88}
        />
        <Tooltip
          content={<DurationTooltip />}
          cursor={{ fill: "var(--color-card-hover)" }}
        />
        <Bar dataKey="avg_days" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {durations.map((row) => (
            <Cell key={row.status_id} fill={row.color_hex} />
          ))}
          <LabelList
            dataKey="avg_days"
            position="right"
            formatter={(value) => `${value}d`}
            style={{ fill: "var(--color-text-muted)", fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
