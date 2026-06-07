import { describe, expect, it } from "vitest";

import {
  BRIDGE_PERIODS,
  bridgeMetrics,
  isInPeriod,
  parsePeriod,
  periodStart,
  pipelineByStage,
  voyagesNeedingAttention,
  voyagesWonOverTime,
  type MetricVoyage,
} from "./bridge";

// A fixed "now" so every period/date assertion is deterministic.
const NOW = new Date("2026-06-15T12:00:00Z");

describe("period helpers", () => {
  it("parses period query params, defaulting to month", () => {
    expect(parsePeriod("quarter")).toBe("quarter");
    expect(parsePeriod("all")).toBe("all");
    expect(parsePeriod("month")).toBe("month");
    expect(parsePeriod("nonsense")).toBe("month");
    expect(parsePeriod(null)).toBe("month");
    expect(parsePeriod(undefined)).toBe("month");
  });

  it("exposes every period in display order", () => {
    expect(BRIDGE_PERIODS).toEqual(["month", "quarter", "all"]);
  });

  it("computes the start of the current month and quarter", () => {
    // June 2026 → month starts 1 Jun; quarter (Apr-Jun) starts 1 Apr.
    expect(periodStart("month", NOW)).toEqual(new Date(2026, 5, 1));
    expect(periodStart("quarter", NOW)).toEqual(new Date(2026, 3, 1));
    expect(periodStart("all", NOW)).toBeNull();
  });

  it("tests membership within a period", () => {
    expect(isInPeriod(new Date("2026-06-10T00:00:00Z"), "month", NOW)).toBe(true);
    expect(isInPeriod(new Date("2026-05-20T00:00:00Z"), "month", NOW)).toBe(false);
    expect(isInPeriod(new Date("2026-05-20T00:00:00Z"), "quarter", NOW)).toBe(true);
    expect(isInPeriod(new Date("2026-01-01T00:00:00Z"), "quarter", NOW)).toBe(false);
    // A future date inside the calendar month but after `now` is excluded.
    expect(isInPeriod(new Date("2026-06-20T00:00:00Z"), "month", NOW)).toBe(false);
    // `all` always matches (when a date is present).
    expect(isInPeriod(new Date("2000-01-01T00:00:00Z"), "all", NOW)).toBe(true);
    expect(isInPeriod(null, "month", NOW)).toBe(false);
    expect(isInPeriod(null, "all", NOW)).toBe(true);
  });
});

describe("bridgeMetrics", () => {
  const voyages: MetricVoyage[] = [
    // Open book (period-independent).
    { value: 100_000, stage: "UNDERWAY", closedAt: null, expectedClose: null }, // 55%
    { value: 50_000, stage: "CHARTED", closedAt: null, expectedClose: null }, // 10%
    // Won this month.
    {
      value: 40_000,
      stage: "ANCHORED",
      closedAt: new Date("2026-06-05T00:00:00Z"),
      expectedClose: null,
    },
    // Won last month (outside the month, inside the quarter).
    {
      value: 30_000,
      stage: "ANCHORED",
      closedAt: new Date("2026-05-05T00:00:00Z"),
      expectedClose: null,
    },
    // Lost this month.
    {
      value: 20_000,
      stage: "WRECKED",
      closedAt: new Date("2026-06-08T00:00:00Z"),
      expectedClose: null,
    },
  ];

  it("totals open pipeline and weighted forecast regardless of period", () => {
    const m = bridgeMetrics(voyages, "month", NOW);
    expect(m.pipelineValue).toBe(150_000);
    // 100k*0.55 + 50k*0.10 = 55k + 5k = 60k.
    expect(m.weightedForecast).toBe(60_000);

    const all = bridgeMetrics(voyages, "all", NOW);
    expect(all.pipelineValue).toBe(150_000);
    expect(all.weightedForecast).toBe(60_000);
  });

  it("scopes wins, won value, and win rate to the period", () => {
    const month = bridgeMetrics(voyages, "month", NOW);
    expect(month.voyagesWon).toBe(1);
    expect(month.wonValue).toBe(40_000);
    // 1 won, 1 lost this month → 50%.
    expect(month.winRate).toBeCloseTo(0.5);

    const quarter = bridgeMetrics(voyages, "quarter", NOW);
    expect(quarter.voyagesWon).toBe(2); // June + May wins
    expect(quarter.wonValue).toBe(70_000);
    // 2 won, 1 lost → 2/3.
    expect(quarter.winRate).toBeCloseTo(2 / 3);
  });

  it("reports a zero win rate when nothing has closed in the period", () => {
    const open: MetricVoyage[] = [
      { value: 10_000, stage: "CHARTED", closedAt: null, expectedClose: null },
    ];
    const m = bridgeMetrics(open, "month", NOW);
    expect(m.winRate).toBe(0);
    expect(m.voyagesWon).toBe(0);
  });
});

describe("pipelineByStage", () => {
  it("buckets open voyages into every open stage, zero-filled and ordered", () => {
    const buckets = pipelineByStage([
      { value: 10_000, stage: "CHARTED" },
      { value: 20_000, stage: "CHARTED" },
      { value: 30_000, stage: "UNDERWAY" },
      { value: 99_000, stage: "ANCHORED" }, // closed — excluded
      { value: 99_000, stage: "WRECKED" }, // closed — excluded
    ]);

    // Only the four open stages appear, in canonical order.
    expect(buckets.map((b) => b.stage)).toEqual([
      "CHARTED",
      "PROVISIONED",
      "UNDERWAY",
      "BOARDING",
    ]);
    const charted = buckets.find((b) => b.stage === "CHARTED")!;
    expect(charted.count).toBe(2);
    expect(charted.value).toBe(30_000);
    const provisioned = buckets.find((b) => b.stage === "PROVISIONED")!;
    expect(provisioned.count).toBe(0);
    expect(provisioned.value).toBe(0);
  });
});

describe("voyagesWonOverTime", () => {
  it("builds a dense, ordered month series counting only wins", () => {
    const series = voyagesWonOverTime(
      [
        {
          value: 10_000,
          stage: "ANCHORED",
          closedAt: new Date("2026-06-05T00:00:00Z"),
        },
        {
          value: 5_000,
          stage: "ANCHORED",
          closedAt: new Date("2026-06-20T00:00:00Z"),
        },
        {
          value: 8_000,
          stage: "ANCHORED",
          closedAt: new Date("2026-04-10T00:00:00Z"),
        },
        // A loss never counts.
        {
          value: 99_000,
          stage: "WRECKED",
          closedAt: new Date("2026-06-01T00:00:00Z"),
        },
        // Outside the 6-month window.
        {
          value: 99_000,
          stage: "ANCHORED",
          closedAt: new Date("2025-01-01T00:00:00Z"),
        },
      ],
      6,
      NOW,
    );

    // Jan..Jun 2026 → 6 ordered buckets ending in June.
    expect(series).toHaveLength(6);
    expect(series.map((p) => p.month)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
    ]);
    const june = series.at(-1)!;
    expect(june.won).toBe(2);
    expect(june.value).toBe(15_000);
    const april = series.find((p) => p.month === "2026-04")!;
    expect(april.won).toBe(1);
    expect(april.value).toBe(8_000);
    const feb = series.find((p) => p.month === "2026-02")!;
    expect(feb.won).toBe(0);
  });
});

describe("voyagesNeedingAttention", () => {
  const base = {
    value: 10_000,
    portName: "Port Royal",
  };

  it("flags overdue and stalled open voyages, most-pressing first", () => {
    const flags = voyagesNeedingAttention(
      [
        {
          ...base,
          id: "overdue",
          name: "Overdue voyage",
          stage: "UNDERWAY",
          expectedClose: new Date("2026-06-01T00:00:00Z"), // 14 days overdue
          updatedAt: new Date("2026-06-14T00:00:00Z"),
        },
        {
          ...base,
          id: "stalled",
          name: "Stalled voyage",
          stage: "CHARTED",
          expectedClose: new Date("2026-07-30T00:00:00Z"), // future, not overdue
          updatedAt: new Date("2026-05-01T00:00:00Z"), // 45 days idle
        },
        {
          ...base,
          id: "healthy",
          name: "Healthy voyage",
          stage: "BOARDING",
          expectedClose: new Date("2026-07-30T00:00:00Z"),
          updatedAt: new Date("2026-06-14T00:00:00Z"), // touched yesterday
        },
        {
          ...base,
          id: "won",
          name: "Won voyage",
          stage: "ANCHORED", // closed — never flagged
          expectedClose: new Date("2026-01-01T00:00:00Z"),
          updatedAt: new Date("2026-01-01T00:00:00Z"),
        },
      ],
      NOW,
    );

    expect(flags.map((f) => f.id)).toEqual(["stalled", "overdue"]);
    const stalled = flags.find((f) => f.id === "stalled")!;
    expect(stalled.reason).toBe("stalled");
    expect(stalled.days).toBe(45);
    const overdue = flags.find((f) => f.id === "overdue")!;
    expect(overdue.reason).toBe("overdue");
    expect(overdue.days).toBe(14);
  });
});
