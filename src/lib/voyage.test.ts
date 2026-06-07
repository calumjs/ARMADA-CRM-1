import { describe, expect, it } from "vitest";
import {
  VOYAGE_STAGES,
  boardSummary,
  formatPercent,
  formatValue,
  isOpenStage,
  stageMeta,
  stageProbability,
  voyageHealth,
  weightedPipeline,
} from "./voyage";

describe("voyage domain helpers", () => {
  it("knows every stage including the full set the schema defines", () => {
    expect(VOYAGE_STAGES).toEqual([
      "CHARTED",
      "PROVISIONED",
      "UNDERWAY",
      "BOARDING",
      "ANCHORED",
      "WRECKED",
    ]);
  });

  it("marks open vs closed stages correctly", () => {
    expect(isOpenStage("CHARTED")).toBe(true);
    expect(isOpenStage("UNDERWAY")).toBe(true);
    expect(isOpenStage("ANCHORED")).toBe(false);
    expect(isOpenStage("WRECKED")).toBe(false);
  });

  it("exposes metadata for each stage", () => {
    for (const stage of VOYAGE_STAGES) {
      const meta = stageMeta(stage);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("formats whole-unit currency without fractional pence", () => {
    expect(formatValue(120000)).toBe("$120,000");
    expect(formatValue(0)).toBe("$0");
  });

  it("sums open pipeline value, ignoring closed voyages by default", () => {
    const voyages = [
      { value: 100, probability: 50, stage: "CHARTED" as const },
      { value: 200, probability: 100, stage: "ANCHORED" as const },
      { value: 300, probability: 10, stage: "WRECKED" as const },
    ];
    expect(weightedPipeline(voyages)).toBe(100);
  });

  it("weights pipeline value by probability when asked", () => {
    const voyages = [
      { value: 100, probability: 50, stage: "UNDERWAY" as const },
      { value: 200, probability: 25, stage: "BOARDING" as const },
    ];
    expect(weightedPipeline(voyages, { weighted: true })).toBe(50 + 50);
  });

  it("assigns a static probability per stage, monotonic toward won", () => {
    expect(stageProbability("CHARTED")).toBeLessThan(
      stageProbability("UNDERWAY"),
    );
    expect(stageProbability("ANCHORED")).toBe(100);
    expect(stageProbability("WRECKED")).toBe(0);
  });
});

describe("voyageHealth", () => {
  const now = new Date("2026-06-07T00:00:00Z");

  it("reports won/lost outcomes for closed voyages", () => {
    expect(
      voyageHealth({ stage: "ANCHORED", expectedClose: null }, now).health,
    ).toBe("closed");
    expect(
      voyageHealth({ stage: "WRECKED", expectedClose: null }, now).accent,
    ).toBe("red");
  });

  it("flags overdue open voyages as stalled", () => {
    const h = voyageHealth(
      { stage: "UNDERWAY", expectedClose: "2026-06-01" },
      now,
    );
    expect(h.health).toBe("stalled");
    expect(h.accent).toBe("red");
  });

  it("warns when an open voyage is closing within a week", () => {
    const h = voyageHealth(
      { stage: "BOARDING", expectedClose: "2026-06-10" },
      now,
    );
    expect(h.health).toBe("watch");
  });

  it("is healthy with plenty of runway or no close date", () => {
    expect(
      voyageHealth({ stage: "CHARTED", expectedClose: "2026-09-01" }, now)
        .health,
    ).toBe("healthy");
    expect(
      voyageHealth({ stage: "CHARTED", expectedClose: null }, now).health,
    ).toBe("healthy");
  });
});

describe("boardSummary", () => {
  it("rolls open value, weighted forecast, and win rate", () => {
    const voyages = [
      { value: 100, stage: "CHARTED" as const }, // open, 10%
      { value: 200, stage: "BOARDING" as const }, // open, 80%
      { value: 500, stage: "ANCHORED" as const }, // won
      { value: 300, stage: "WRECKED" as const }, // lost
    ];
    const s = boardSummary(voyages);
    expect(s.pipeline).toBe(300);
    expect(s.forecast).toBe(Math.round(100 * 0.1 + 200 * 0.8)); // 170
    expect(s.won).toBe(1);
    expect(s.lost).toBe(1);
    expect(s.open).toBe(2);
    expect(s.winRate).toBeCloseTo(0.5);
  });

  it("reports a zero win rate when nothing has closed", () => {
    const s = boardSummary([{ value: 100, stage: "CHARTED" as const }]);
    expect(s.winRate).toBe(0);
  });
});

describe("formatPercent", () => {
  it("renders a 0-1 fraction as a whole percentage", () => {
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.625)).toBe("63%");
  });
});
