import { describe, expect, it } from "vitest";

import {
  CHART_HEIGHT,
  CHART_WIDTH,
  coastlinePath,
  hashSeed,
  harbourLineX,
  layoutFleet,
  mulberry32,
  placeShip,
  seededRng,
  shipSize,
  stageProgress,
  weatherFor,
  type ChartVoyage,
} from "./chart";

const voyage = (over: Partial<ChartVoyage> = {}): ChartVoyage => ({
  id: "v1",
  name: "Test voyage",
  stage: "UNDERWAY",
  value: 50_000,
  expectedClose: null,
  portName: "Port Royal",
  ...over,
});

describe("seeded randomness", () => {
  it("hashSeed is deterministic and unsigned", () => {
    expect(hashSeed("armada")).toBe(hashSeed("armada"));
    expect(hashSeed("armada")).not.toBe(hashSeed("fleet"));
    expect(hashSeed("armada")).toBeGreaterThanOrEqual(0);
  });

  it("mulberry32 yields a stable stream in [0,1)", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    for (const n of seqA) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });

  it("seededRng with different seeds diverges", () => {
    const x = seededRng("one")();
    const y = seededRng("two")();
    expect(x).not.toBe(y);
  });
});

describe("coastline", () => {
  it("is deterministic for a given seed", () => {
    expect(coastlinePath("repo-1")).toBe(coastlinePath("repo-1"));
  });

  it("differs between seeds", () => {
    expect(coastlinePath("repo-1")).not.toBe(coastlinePath("repo-2"));
  });

  it("produces a closed, fillable path on the right side", () => {
    const d = coastlinePath("repo-1");
    expect(d.startsWith("M")).toBe(true);
    expect(d.trim().endsWith("Z")).toBe(true);
    // The land mass hugs the right edge.
    expect(d).toContain(`${CHART_WIDTH} 0`);
    expect(harbourLineX()).toBeCloseTo(CHART_WIDTH * 0.72);
  });
});

describe("ship sizing", () => {
  it("scales monotonically with value but clamps", () => {
    expect(shipSize(0)).toBeGreaterThanOrEqual(10);
    expect(shipSize(1_000)).toBeLessThan(shipSize(1_000_000));
    expect(shipSize(10_000_000_000)).toBeLessThanOrEqual(34);
  });

  it("never returns a negative or sub-floor size", () => {
    expect(shipSize(-5)).toBeGreaterThanOrEqual(10);
  });
});

describe("stage progress", () => {
  it("orders ships from open sea toward harbour by pipeline stage", () => {
    expect(stageProgress("CHARTED")).toBeLessThan(stageProgress("PROVISIONED"));
    expect(stageProgress("PROVISIONED")).toBeLessThan(
      stageProgress("UNDERWAY"),
    );
    expect(stageProgress("UNDERWAY")).toBeLessThan(stageProgress("BOARDING"));
    expect(stageProgress("BOARDING")).toBeLessThan(stageProgress("ANCHORED"));
    expect(stageProgress("ANCHORED")).toBeGreaterThan(0.9);
  });
});

describe("weather", () => {
  it("maps health to a weather band", () => {
    expect(weatherFor("stalled")).toBe("stormy");
    expect(weatherFor("watch")).toBe("fair");
    expect(weatherFor("healthy")).toBe("calm");
    expect(weatherFor("closed")).toBe("calm");
  });
});

describe("placeShip", () => {
  it("is deterministic for the same voyage + seed", () => {
    const a = placeShip(voyage(), "seed");
    const b = placeShip(voyage(), "seed");
    expect(a.x).toBe(b.x);
    expect(a.y).toBe(b.y);
    expect(a.phase).toBe(b.phase);
  });

  it("keeps ships within the drawing surface", () => {
    for (let i = 0; i < 30; i++) {
      const ship = placeShip(voyage({ id: `v${i}` }), "seed");
      expect(ship.x).toBeGreaterThan(0);
      expect(ship.x).toBeLessThan(CHART_WIDTH);
      expect(ship.y).toBeGreaterThan(0);
      expect(ship.y).toBeLessThan(CHART_HEIGHT);
    }
  });

  it("places later-stage voyages closer to harbour", () => {
    const charted = placeShip(voyage({ id: "a", stage: "CHARTED" }), "seed");
    const boarding = placeShip(voyage({ id: "a", stage: "BOARDING" }), "seed");
    // Same id ⇒ same jitter, so stage alone moves it toward harbour.
    expect(boarding.x).toBeGreaterThan(charted.x);
  });

  it("derives weather from a stalled (overdue) voyage", () => {
    const past = new Date("2000-01-01").toISOString().slice(0, 10);
    const ship = placeShip(
      voyage({ stage: "UNDERWAY", expectedClose: past }),
      "seed",
      CHART_WIDTH,
      CHART_HEIGHT,
      new Date("2030-01-01"),
    );
    expect(ship.health).toBe("stalled");
    expect(ship.weather).toBe("stormy");
    expect(ship.accent).toBe("red");
  });
});

describe("layoutFleet", () => {
  const fleet: ChartVoyage[] = [
    voyage({ id: "open1", stage: "CHARTED" }),
    voyage({ id: "open2", stage: "BOARDING" }),
    voyage({ id: "won", stage: "ANCHORED" }),
    voyage({ id: "lost", stage: "WRECKED" }),
  ];

  it("charts only active (open) voyages by default", () => {
    const ships = layoutFleet(fleet, "seed");
    const ids = ships.map((s) => s.id).sort();
    expect(ids).toEqual(["open1", "open2"]);
  });

  it("can include closed voyages when asked", () => {
    const ships = layoutFleet(fleet, "seed", { activeOnly: false });
    expect(ships).toHaveLength(4);
  });

  it("draws larger ships first (smaller painted on top)", () => {
    const big = voyage({ id: "big", stage: "UNDERWAY", value: 900_000 });
    const small = voyage({ id: "small", stage: "UNDERWAY", value: 1_000 });
    const ships = layoutFleet([small, big], "seed");
    expect(ships[0].id).toBe("big");
    expect(ships[0].size).toBeGreaterThan(ships[1].size);
  });

  it("scales to ~50 voyages without collisions in the id set", () => {
    const many: ChartVoyage[] = Array.from({ length: 50 }, (_, i) =>
      voyage({ id: `v${i}`, stage: "UNDERWAY" }),
    );
    const ships = layoutFleet(many, "seed");
    expect(ships).toHaveLength(50);
    expect(new Set(ships.map((s) => s.id)).size).toBe(50);
  });
});
