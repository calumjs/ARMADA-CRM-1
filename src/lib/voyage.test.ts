import { describe, expect, it } from "vitest";
import {
  VOYAGE_STAGES,
  formatValue,
  isOpenStage,
  stageMeta,
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
});
