/**
 * Search/filter helpers for The Helm command palette.
 *
 * Kept free of Prisma, React, and DOM imports so the ranking logic is trivially
 * unit-testable and reusable on both the server (building the index from live
 * data) and the client (filtering the fetched index as the user types).
 */

/** The kind of fleet record a search hit points at. */
export type SearchKind = "port" | "captain" | "voyage";

/** A single searchable record surfaced in the palette. */
export interface SearchItem {
  /** Stable id of the underlying record. */
  id: string;
  kind: SearchKind;
  /** Primary label shown in the list. */
  title: string;
  /** Optional secondary line (e.g. industry, port name, stage). */
  subtitle?: string;
  /**
   * Extra free text folded into matching but not displayed — e.g. a captain's
   * email, or a voyage's port name — so a query can find a record by an
   * attribute that isn't its title.
   */
  keywords?: string;
  /** Route the hit navigates to when selected. */
  href: string;
}

/** A search hit paired with the score it earned for the current query. */
export interface ScoredItem extends SearchItem {
  score: number;
}

/** Lower-case, collapse whitespace, strip diacritics for tolerant matching. */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Score how well `query` matches `text`, 0 meaning no match and higher meaning
 * a better match. The scheme is deliberately simple but ranks intuitively:
 *
 *  - exact match            → highest
 *  - prefix match           → high
 *  - whole-substring match  → medium (earlier position scores higher)
 *  - subsequence (fuzzy)    → low, scaled by how contiguous the match is
 *
 * An empty query matches everything with a neutral score so callers can show a
 * default list. Returns 0 (no match) when the query's characters can't be found
 * in order.
 */
export function scoreMatch(query: string, text: string): number {
  const q = normalize(query);
  const t = normalize(text);

  if (q.length === 0) return 1;
  if (t.length === 0) return 0;

  if (t === q) return 1000;
  if (t.startsWith(q)) return 800 - q.length; // longer exact prefixes are fine; keep stable
  const idx = t.indexOf(q);
  if (idx !== -1) return 500 - idx; // earlier substring wins

  // Subsequence (fuzzy) match: every char of q appears in t, in order.
  let ti = 0;
  let matched = 0;
  let runs = 0; // count of contiguous runs — fewer runs = more contiguous = better
  let prevMatched = false;
  for (let qi = 0; qi < q.length; qi++) {
    const ch = q[qi];
    let found = false;
    while (ti < t.length) {
      if (t[ti] === ch) {
        matched++;
        if (!prevMatched) runs++;
        prevMatched = true;
        ti++;
        found = true;
        break;
      }
      prevMatched = false;
      ti++;
    }
    if (!found) return 0; // a query char couldn't be placed in order → no match
  }
  if (matched < q.length) return 0;

  // Base 100 for any subsequence match; reward contiguity (fewer runs).
  return 100 - (runs - 1) * 10;
}

/**
 * Score an item against a query, taking the best of its title (weighted up),
 * subtitle, and hidden keywords so a record is findable by any of its facets.
 */
export function scoreItem(query: string, item: SearchItem): number {
  if (normalize(query).length === 0) return 1;
  const title = scoreMatch(query, item.title);
  const subtitle = item.subtitle ? scoreMatch(query, item.subtitle) * 0.6 : 0;
  const keywords = item.keywords ? scoreMatch(query, item.keywords) * 0.5 : 0;
  return Math.max(title, subtitle, keywords);
}

/**
 * Filter and rank `items` for `query`. With an empty query the original order
 * is preserved (callers typically pass an already-ordered "recent / relevant"
 * list). Non-matching items are dropped. Ties break by title so ordering is
 * stable run-to-run.
 */
export function searchItems(
  query: string,
  items: SearchItem[],
  { limit }: { limit?: number } = {},
): ScoredItem[] {
  const trimmed = normalize(query);

  let scored: ScoredItem[];
  if (trimmed.length === 0) {
    scored = items.map((item) => ({ ...item, score: 1 }));
  } else {
    scored = items
      .map((item) => ({ ...item, score: scoreItem(query, item) }))
      .filter((item) => item.score > 0)
      .sort((a, b) =>
        b.score !== a.score
          ? b.score - a.score
          : a.title.localeCompare(b.title),
      );
  }

  return typeof limit === "number" ? scored.slice(0, limit) : scored;
}

/** Group ranked items by kind, preserving each group's ranked order. */
export function groupByKind(
  items: ScoredItem[],
): Record<SearchKind, ScoredItem[]> {
  const groups: Record<SearchKind, ScoredItem[]> = {
    port: [],
    captain: [],
    voyage: [],
  };
  for (const item of items) groups[item.kind].push(item);
  return groups;
}
