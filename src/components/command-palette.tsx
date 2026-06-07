"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Anchor,
  Building2,
  Compass,
  LayoutDashboard,
  PlusCircle,
  ScrollText,
  Ship,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  groupByKind,
  searchItems,
  type SearchItem,
  type SearchKind,
} from "@/lib/search";

/** Custom DOM event that opens the palette from anywhere (e.g. a nav button). */
export const HELM_OPEN_EVENT = "helm:open";

/** Imperatively open The Helm from a UI affordance outside the palette. */
export function openHelm() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(HELM_OPEN_EVENT));
  }
}

/** A non-record command: navigation or a quick action. */
interface ActionItem {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  /** Route to push. Used as the graceful-degradation target for actions too. */
  href: string;
  shortcut?: string;
}

const NAV_ACTIONS: ActionItem[] = [
  {
    id: "nav-bridge",
    label: "Bridge",
    hint: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    id: "nav-chart",
    label: "Chart",
    hint: "Deal map",
    icon: Compass,
    href: "/chart",
  },
  {
    id: "nav-voyages",
    label: "Voyages",
    hint: "Deals",
    icon: Anchor,
    href: "/voyages",
  },
  {
    id: "nav-ports",
    label: "Ports",
    hint: "Companies",
    icon: Building2,
    href: "/ports",
  },
];

// Quick actions. Dedicated create/new routes land in sibling issues; until then
// these degrade to the nearest existing surface (the relevant list / the log).
const QUICK_ACTIONS: ActionItem[] = [
  {
    id: "new-voyage",
    label: "New Voyage",
    hint: "Start a deal",
    icon: PlusCircle,
    href: "/voyages?new=1",
  },
  {
    id: "new-port",
    label: "New Port",
    hint: "Add a company",
    icon: PlusCircle,
    href: "/ports?new=1",
  },
  {
    id: "log-note",
    label: "Log Note",
    hint: "Record an activity",
    icon: ScrollText,
    href: "/log?new=1",
  },
];

const KIND_META: Record<SearchKind, { heading: string; icon: LucideIcon }> = {
  port: { heading: "Ports", icon: Building2 },
  captain: { heading: "Captains", icon: UserRound },
  voyage: { heading: "Voyages", icon: Ship },
};

const RECENTS_KEY = "armada:helm:recents";
const MAX_RECENTS = 5;
const RESULTS_PER_GROUP = 6;
const DEBOUNCE_MS = 150;

function loadRecents(): SearchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SearchItem[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(item: SearchItem) {
  if (typeof window === "undefined") return;
  try {
    const existing = loadRecents().filter((r) => r.id !== item.id);
    const next = [item, ...existing].slice(0, MAX_RECENTS);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    // Best-effort; recents are a nicety, never a hard dependency.
  }
}

/**
 * The Helm — a ⌘K / Ctrl-K command palette available globally from the app
 * shell. Fuzzy-searches live ports, captains, and voyages; runs quick actions
 * and global navigation; keyboard-navigable and accessible via cmdk + Radix
 * Dialog (focus trap, aria roles, Esc to close).
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [index, setIndex] = React.useState<SearchItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState(false);
  const [recents, setRecents] = React.useState<SearchItem[]>([]);
  const loadedRef = React.useRef(false);

  // ⌘K / Ctrl-K toggles the palette from anywhere; a custom event lets UI
  // affordances (e.g. a search button in the top bar) open it too.
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(HELM_OPEN_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(HELM_OPEN_EVENT, onOpenEvent);
    };
  }, []);

  // Debounce the query so filtering doesn't churn on every keystroke.
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(query), DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  // Lazily fetch the live search index the first time the palette opens, and
  // refresh recents from storage each time it opens.
  React.useEffect(() => {
    if (!open) return;
    setRecents(loadRecents());
    if (loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    setLoadError(false);
    fetch("/api/search")
      .then((res) => {
        if (!res.ok) throw new Error(`search ${res.status}`);
        return res.json();
      })
      .then((data: { items?: SearchItem[] }) => {
        setIndex(Array.isArray(data.items) ? data.items : []);
      })
      .catch(() => {
        setLoadError(true);
        loadedRef.current = false; // allow a retry on the next open
      })
      .finally(() => setLoading(false));
  }, [open]);

  const hasQuery = debouncedQuery.trim().length > 0;

  const grouped = React.useMemo(() => {
    if (!hasQuery) return null;
    const ranked = searchItems(debouncedQuery, index);
    return groupByKind(ranked);
  }, [debouncedQuery, index, hasQuery]);

  const navigate = React.useCallback(
    (href: string, record?: SearchItem) => {
      if (record) {
        saveRecent(record);
      }
      setOpen(false);
      setQuery("");
      setDebouncedQuery("");
      router.push(href);
    },
    [router],
  );

  const recordGroups: { kind: SearchKind; items: SearchItem[] }[] = grouped
    ? (Object.keys(KIND_META) as SearchKind[])
        .map((kind) => ({
          kind,
          items: grouped[kind].slice(0, RESULTS_PER_GROUP),
        }))
        .filter((g) => g.items.length > 0)
    : [];

  const showRecents = !hasQuery && recents.length > 0;

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="The Helm — command palette"
      description="Search ports, captains, and voyages, or run a quick action."
    >
      <CommandInput
        placeholder="Search the fleet or run a command…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>

        {/* Search status / empty-record feedback while searching. */}
        {hasQuery && (loading || loadError || recordGroups.length === 0) ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {loading
              ? "Charting the fleet…"
              : loadError
                ? "Couldn't reach the fleet. Try again."
                : "No ports, captains, or voyages match."}
          </div>
        ) : null}

        {/* Live record results (only while searching). */}
        {recordGroups.map(({ kind, items }) => {
          const meta = KIND_META[kind];
          return (
            <CommandGroup key={kind} heading={meta.heading}>
              {items.map((item) => {
                const Icon = meta.icon;
                return (
                  <CommandItem
                    key={`${item.kind}:${item.id}`}
                    value={`${item.kind}:${item.id}:${item.title}`}
                    onSelect={() => navigate(item.href, item)}
                  >
                    <Icon className="text-brass" />
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate">{item.title}</span>
                      {item.subtitle ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {item.subtitle}
                        </span>
                      ) : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          );
        })}

        {/* Recent records when the query is empty. */}
        {showRecents ? (
          <CommandGroup heading="Recent">
            {recents.map((item) => {
              const Icon = KIND_META[item.kind].icon;
              return (
                <CommandItem
                  key={`recent:${item.kind}:${item.id}`}
                  value={`recent:${item.kind}:${item.id}:${item.title}`}
                  onSelect={() => navigate(item.href, item)}
                >
                  <Icon className="text-brass" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate">{item.title}</span>
                    {item.subtitle ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {item.subtitle}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {showRecents ? <CommandSeparator /> : null}

        {/* Quick actions — always available. */}
        <CommandGroup heading="Quick Actions">
          {QUICK_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.id}
                value={`action ${action.label} ${action.hint ?? ""}`}
                onSelect={() => navigate(action.href)}
              >
                <Icon className="text-brass" />
                <span className="flex min-w-0 flex-col leading-tight">
                  <span>{action.label}</span>
                  {action.hint ? (
                    <span className="text-xs text-muted-foreground">
                      {action.hint}
                    </span>
                  ) : null}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>

        <CommandSeparator />

        {/* Global navigation — always available. */}
        <CommandGroup heading="Go To">
          {NAV_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <CommandItem
                key={action.id}
                value={`go ${action.label} ${action.hint ?? ""}`}
                onSelect={() => navigate(action.href)}
              >
                <Icon className="text-brass" />
                <span>{action.label}</span>
                {action.hint ? (
                  <CommandShortcut>{action.hint}</CommandShortcut>
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
