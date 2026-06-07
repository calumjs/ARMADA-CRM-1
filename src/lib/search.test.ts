import { describe, expect, it } from "vitest";
import {
  groupByKind,
  normalize,
  scoreItem,
  scoreMatch,
  searchItems,
  type SearchItem,
} from "./search";

const ITEMS: SearchItem[] = [
  {
    id: "p1",
    kind: "port",
    title: "Meridian Shipping Co.",
    subtitle: "Logistics · Bristol",
    href: "/ports/p1",
  },
  {
    id: "p2",
    kind: "port",
    title: "Saltworks Trading",
    subtitle: "Commodities · Lisbon",
    href: "/ports/p2",
  },
  {
    id: "c1",
    kind: "captain",
    title: "Ada Vance",
    subtitle: "Procurement Lead · Meridian Shipping Co.",
    keywords: "ada.vance@example.com",
    href: "/captains/c1",
  },
  {
    id: "v1",
    kind: "voyage",
    title: "Spice Route Renewal",
    subtitle: "Underway · Meridian Shipping Co.",
    href: "/voyages/v1",
  },
];

describe("normalize", () => {
  it("lower-cases, trims, and collapses whitespace", () => {
    expect(normalize("  Hello   World ")).toBe("hello world");
  });

  it("strips diacritics so accented names still match", () => {
    expect(normalize("Søren Moreau")).toBe("søren moreau"); // ø is not a combining mark
    expect(normalize("Café")).toBe("cafe");
  });
});

describe("scoreMatch", () => {
  it("treats an empty query as a neutral match", () => {
    expect(scoreMatch("", "anything")).toBeGreaterThan(0);
  });

  it("ranks exact > prefix > substring > subsequence > no-match", () => {
    const exact = scoreMatch("meridian", "meridian");
    const prefix = scoreMatch("meri", "meridian shipping");
    const substring = scoreMatch("shipping", "meridian shipping");
    const subsequence = scoreMatch("msh", "meridian shipping");
    const none = scoreMatch("zzz", "meridian shipping");

    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(subsequence);
    expect(subsequence).toBeGreaterThan(0);
    expect(none).toBe(0);
  });

  it("returns 0 when query characters are out of order", () => {
    expect(scoreMatch("nacid", "meridian")).toBe(0);
  });

  it("is case- and accent-insensitive", () => {
    // é decomposes under NFD (e + combining acute), so it folds to a plain e.
    expect(scoreMatch("MOREAU", "Moréau")).toBeGreaterThan(0);
    expect(scoreMatch("cafe", "Café")).toBeGreaterThan(0);
  });
});

describe("scoreItem", () => {
  it("matches a captain by their hidden email keyword", () => {
    const captain = ITEMS[2];
    expect(scoreItem("ada.vance@example.com", captain)).toBeGreaterThan(0);
  });

  it("weights a title match above a subtitle-only match", () => {
    const byTitle = scoreItem("spice", ITEMS[3]);
    const bySubtitle = scoreItem("underway", ITEMS[3]);
    expect(byTitle).toBeGreaterThan(bySubtitle);
  });
});

describe("searchItems", () => {
  it("returns every item, in original order, for an empty query", () => {
    const result = searchItems("", ITEMS);
    expect(result).toHaveLength(ITEMS.length);
    expect(result.map((i) => i.id)).toEqual(ITEMS.map((i) => i.id));
  });

  it("filters out non-matching items", () => {
    const result = searchItems("salt", ITEMS);
    expect(result.map((i) => i.id)).toEqual(["p2"]);
  });

  it("finds records across kinds by a shared substring", () => {
    // "meridian" appears in a port title and in captain/voyage subtitles.
    const ids = searchItems("meridian", ITEMS).map((i) => i.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("c1");
    expect(ids).toContain("v1");
    // The port whose *title* is Meridian ranks first.
    expect(ids[0]).toBe("p1");
  });

  it("honours the limit option", () => {
    expect(searchItems("", ITEMS, { limit: 2 })).toHaveLength(2);
  });

  it("ranks an exact-prefix hit ahead of a fuzzy one", () => {
    const ranked = searchItems("sp", ITEMS).map((i) => i.id);
    expect(ranked[0]).toBe("v1"); // "Spice…" prefix beats any fuzzy hit
  });
});

describe("groupByKind", () => {
  it("buckets ranked items by kind, preserving order", () => {
    const groups = groupByKind(searchItems("", ITEMS));
    expect(groups.port.map((i) => i.id)).toEqual(["p1", "p2"]);
    expect(groups.captain.map((i) => i.id)).toEqual(["c1"]);
    expect(groups.voyage.map((i) => i.id)).toEqual(["v1"]);
  });

  it("always returns all three buckets even when some are empty", () => {
    const groups = groupByKind(searchItems("salt", ITEMS));
    expect(groups.port).toHaveLength(1);
    expect(groups.captain).toHaveLength(0);
    expect(groups.voyage).toHaveLength(0);
  });
});
