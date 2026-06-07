"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatValue } from "@/lib/voyage";
import type { StageBucket, WonOverTimePoint } from "@/lib/bridge";

/** Map a signal-flag accent token to its CSS-variable colour. */
const ACCENT_COLOR: Record<StageBucket["accent"], string> = {
  blue: "hsl(var(--signal-blue))",
  yellow: "hsl(var(--signal-yellow))",
  green: "hsl(var(--signal-green))",
  red: "hsl(var(--signal-red))",
  white: "hsl(var(--muted-foreground))",
};

const AXIS_TICK = {
  fill: "hsl(var(--muted-foreground))",
  fontSize: 12,
};

function chartTooltipStyle(): React.CSSProperties {
  return {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "var(--radius)",
    color: "hsl(var(--popover-foreground))",
    fontSize: 12,
  };
}

/** Compact currency for axis ticks, e.g. "$120k". */
function compactValue(value: number): string {
  if (value >= 1000) return `$${Math.round(value / 1000)}k`;
  return `$${value}`;
}

/**
 * The pipeline-by-stage funnel: a horizontal bar per open stage, coloured by
 * the stage's signal-flag accent, sized by combined open value.
 */
export function PipelineByStageChart({ data }: { data: StageBucket[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
      >
        <CartesianGrid
          horizontal={false}
          stroke="hsl(var(--border))"
          strokeDasharray="3 3"
        />
        <XAxis
          type="number"
          tickFormatter={compactValue}
          tick={AXIS_TICK}
          stroke="hsl(var(--border))"
        />
        <YAxis
          type="category"
          dataKey="label"
          width={92}
          tick={AXIS_TICK}
          stroke="hsl(var(--border))"
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          contentStyle={chartTooltipStyle()}
          formatter={(value: number, _name, item) => [
            `${formatValue(value)} · ${item?.payload?.count ?? 0} voyage(s)`,
            "Open value",
          ]}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={28}>
          {data.map((d) => (
            <Cell key={d.stage} fill={ACCENT_COLOR[d.accent]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * The voyages-won-over-time line: one point per month, plotting the count of
 * voyages won, with value surfaced in the tooltip.
 */
export function VoyagesWonChart({ data }: { data: WonOverTimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          stroke="hsl(var(--border))"
          tickFormatter={(label: string) => label.split(" ")[0]}
        />
        <YAxis
          allowDecimals={false}
          tick={AXIS_TICK}
          stroke="hsl(var(--border))"
          width={32}
        />
        <Tooltip
          contentStyle={chartTooltipStyle()}
          formatter={(value: number, _name, item) => [
            `${value} won · ${formatValue(item?.payload?.value ?? 0)}`,
            item?.payload?.label ?? "",
          ]}
          labelFormatter={() => ""}
        />
        <Line
          type="monotone"
          dataKey="won"
          stroke="hsl(var(--brass))"
          strokeWidth={2.5}
          dot={{ fill: "hsl(var(--brass))", r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
