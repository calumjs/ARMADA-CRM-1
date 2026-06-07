import { describe, expect, it } from "vitest";

import {
  captainInitials,
  captainName,
  captainSchema,
  compareBy,
  countOpenVoyages,
  matchesQuery,
  portSchema,
} from "./ports";

describe("port & captain domain helpers", () => {
  it("builds a captain's display name and initials", () => {
    const c = { firstName: "Ada", lastName: "Vance" };
    expect(captainName(c)).toBe("Ada Vance");
    expect(captainInitials(c)).toBe("AV");
  });

  it("counts only open-stage voyages", () => {
    const voyages = [
      { stage: "CHARTED" },
      { stage: "UNDERWAY" },
      { stage: "ANCHORED" }, // closed
      { stage: "WRECKED" }, // closed
    ];
    expect(countOpenVoyages(voyages)).toBe(2);
  });

  it("matches search queries case-insensitively across fields", () => {
    expect(matchesQuery(["Meridian Shipping", "Logistics"], "ship")).toBe(true);
    expect(matchesQuery(["Meridian Shipping", null], "BRISTOL")).toBe(false);
    expect(matchesQuery(["anything"], "")).toBe(true);
  });

  it("compares numbers numerically and strings by locale, honouring direction", () => {
    expect(compareBy(2, 10, "asc")).toBeLessThan(0);
    expect(compareBy(2, 10, "desc")).toBeGreaterThan(0);
    expect(compareBy("apple", "banana", "asc")).toBeLessThan(0);
  });
});

describe("portSchema", () => {
  it("requires a name and trims/normalises optional fields to null", () => {
    const parsed = portSchema.parse({
      name: "  Halcyon Freight  ",
      industry: "",
      website: "  ",
      location: "Rotterdam",
      notes: "",
    });
    expect(parsed.name).toBe("Halcyon Freight");
    expect(parsed.industry).toBeNull();
    expect(parsed.website).toBeNull();
    expect(parsed.location).toBe("Rotterdam");
    expect(parsed.notes).toBeNull();
  });

  it("rejects an empty name", () => {
    const result = portSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });
});

describe("captainSchema", () => {
  it("requires first and last name and normalises a blank port to null", () => {
    const parsed = captainSchema.parse({
      firstName: "Ada",
      lastName: "Vance",
      email: "",
      phone: "",
      title: "Founder",
      notes: "",
      portId: "",
    });
    expect(parsed.firstName).toBe("Ada");
    expect(parsed.email).toBeNull();
    expect(parsed.portId).toBeNull();
    expect(parsed.title).toBe("Founder");
  });

  it("rejects an invalid email but allows a blank one", () => {
    expect(
      captainSchema.safeParse({
        firstName: "Ada",
        lastName: "Vance",
        email: "not-an-email",
      }).success,
    ).toBe(false);

    expect(
      captainSchema.safeParse({
        firstName: "Ada",
        lastName: "Vance",
        email: "",
      }).success,
    ).toBe(true);
  });
});
