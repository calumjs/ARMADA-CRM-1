"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { BRIDGE_PERIODS, PERIOD_LABEL, type BridgePeriod } from "@/lib/bridge";

/**
 * A segmented control that scopes the Bridge metrics to a period. Each option
 * is a `Link` carrying `?period=…`, so the filter is shareable/bookmarkable and
 * the server re-aggregates on navigation — no client data fetching needed.
 */
export function PeriodFilter({ active }: { active: BridgePeriod }) {
  const pathname = usePathname();
  return (
    <div
      role="tablist"
      aria-label="Metric period"
      className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-1"
    >
      {BRIDGE_PERIODS.map((period) => {
        const isActive = period === active;
        return (
          <Link
            key={period}
            role="tab"
            aria-selected={isActive}
            href={
              period === "month"
                ? pathname
                : `${pathname}?period=${period}`
            }
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-brass text-brass-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PERIOD_LABEL[period]}
          </Link>
        );
      })}
    </div>
  );
}
