import { describe, expect, it } from "vitest";

import {
  NAVIGATOR_MODEL,
  buildPortSummaryPrompt,
  buildVoyagePrompt,
  hasGatewayKey,
  nextBestAction,
  tidesScore,
  type VoyageSnapshot,
} from "./navigator";

const now = new Date("2026-06-07T00:00:00Z");

function voyage(over: Partial<VoyageSnapshot> = {}): VoyageSnapshot {
  return {
    name: "Spice Run",
    stage: "UNDERWAY",
    value: 120000,
    expectedClose: "2026-07-01",
    portName: "East India Trading Co.",
    captainName: "Jack Sparrow",
    notes: null,
    activities: [
      { type: "CALL", subject: "Discovery call", occurredAt: "2026-06-05" },
    ],
    ...over,
  };
}

describe("tidesScore (reading the tides)", () => {
  it("reports 100 for a won voyage and 0 for a wrecked one", () => {
    expect(tidesScore(voyage({ stage: "ANCHORED" }), now).score).toBe(100);
    expect(tidesScore(voyage({ stage: "ANCHORED" }), now).accent).toBe("green");
    expect(tidesScore(voyage({ stage: "WRECKED" }), now).score).toBe(0);
    expect(tidesScore(voyage({ stage: "WRECKED" }), now).accent).toBe("red");
  });

  it("always returns a score within 0-100", () => {
    const sinking = tidesScore(
      voyage({
        stage: "CHARTED",
        expectedClose: "2026-01-01", // very overdue
        activities: [], // nothing logged
      }),
      now,
    );
    expect(sinking.score).toBeGreaterThanOrEqual(0);
    expect(sinking.score).toBeLessThanOrEqual(100);
  });

  it("rewards recent contact and penalises a stale, overdue voyage", () => {
    const fresh = tidesScore(
      voyage({ stage: "BOARDING", expectedClose: "2026-06-20" }),
      now,
    );
    const stale = tidesScore(
      voyage({
        stage: "BOARDING",
        expectedClose: "2026-05-01", // overdue
        activities: [
          { type: "EMAIL", subject: "Sent proposal", occurredAt: "2026-04-01" },
        ],
      }),
      now,
    );
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it("derives accent + band consistently from the score", () => {
    const r = tidesScore(voyage(), now);
    if (r.score >= 66) {
      expect(r.band).toBe("Strong");
      expect(r.accent).toBe("green");
    } else if (r.score >= 40) {
      expect(r.band).toBe("Watch");
      expect(r.accent).toBe("yellow");
    } else {
      expect(r.band).toBe("At risk");
      expect(r.accent).toBe("red");
    }
    expect(r.rationale.endsWith(".")).toBe(true);
  });

  it("works without an activity list (board card path)", () => {
    const r = tidesScore(
      { name: "x", stage: "CHARTED", value: 10, expectedClose: null },
      now,
    );
    expect(typeof r.score).toBe("number");
  });
});

describe("nextBestAction", () => {
  it("suggests opening contact when nothing is logged", () => {
    expect(
      nextBestAction(voyage({ activities: [] }), now).toLowerCase(),
    ).toContain("discovery call");
  });

  it("nudges a re-engagement when contact has gone quiet", () => {
    const action = nextBestAction(
      voyage({
        activities: [
          { type: "CALL", subject: "Old call", occurredAt: "2026-04-01" },
        ],
      }),
      now,
    );
    expect(action.toLowerCase()).toContain("days");
  });

  it("reflects the won/lost outcome for closed voyages", () => {
    expect(nextBestAction(voyage({ stage: "ANCHORED" }), now)).toContain(
      "anchored",
    );
    expect(nextBestAction(voyage({ stage: "WRECKED" }), now)).toContain(
      "wrecked",
    );
  });
});

describe("prompt builders", () => {
  it("includes the voyage facts and a task-specific instruction", () => {
    const p = buildVoyagePrompt("next-action", voyage(), now);
    expect(p).toContain("Spice Run");
    expect(p).toContain("East India Trading Co.");
    expect(p).toContain("next action");
  });

  it("asks for an email under a word limit for follow-up drafts", () => {
    const p = buildVoyagePrompt("draft-follow-up", voyage(), now);
    expect(p.toLowerCase()).toContain("follow-up email");
    expect(p.toLowerCase()).toContain("words");
  });

  it("summarises a port across its voyages", () => {
    const p = buildPortSummaryPrompt(
      {
        name: "East India Trading Co.",
        industry: "Shipping",
        voyages: [
          { name: "Spice Run", stage: "UNDERWAY", value: 120000 },
          { name: "Silk Route", stage: "ANCHORED", value: 80000 },
        ],
        activities: [
          { type: "MEETING", subject: "QBR", occurredAt: "2026-06-01" },
        ],
      },
      now,
    );
    expect(p).toContain("East India Trading Co.");
    expect(p).toContain("Spice Run");
    expect(p).toContain("Silk Route");
    expect(p.toLowerCase()).toContain("summarise");
  });
});

describe("configuration", () => {
  it("uses a plain provider/model gateway string", () => {
    expect(NAVIGATOR_MODEL).toMatch(/^[\w.-]+\/[\w.-]+$/);
  });

  it("detects the gateway key from the environment", () => {
    expect(hasGatewayKey({} as NodeJS.ProcessEnv)).toBe(false);
    expect(
      hasGatewayKey({ AI_GATEWAY_API_KEY: "sk-test" } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      hasGatewayKey({ AI_GATEWAY_API_KEY: "   " } as NodeJS.ProcessEnv),
    ).toBe(false);
  });
});
