"use client";

import * as React from "react";
import { Compass, Loader2, PenLine, ScrollText, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { TidesReading } from "@/lib/navigator";

const TIDES_BADGE = {
  green: "signal-green",
  yellow: "signal-yellow",
  red: "signal-red",
} as const;

type NavigatorTask = "next-action" | "draft-follow-up" | "summarise";

/**
 * The Navigator panel — the AI co-pilot on a voyage's detail page.
 *
 * The deal-health ("tides") score and the deterministic next-best-action are
 * computed server-side and passed in, so they render instantly and work with no
 * AI key. The Summarise and Draft follow-up actions call the server route; the
 * draft streams in and lands in an editable textarea.
 */
export function NavigatorPanel({
  voyageId,
  tides,
  nextAction,
  configured,
}: {
  voyageId: string;
  tides: TidesReading;
  nextAction: string;
  configured: boolean;
}) {
  const [summary, setSummary] = React.useState("");
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState<NavigatorTask | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function summarise() {
    setError(null);
    setPending("summarise");
    setSummary("");
    try {
      const res = await fetch("/api/navigator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "summarise", voyageId }),
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || data.error) {
        setError(data.error ?? "The Navigator couldn't summarise this voyage.");
        return;
      }
      setSummary(data.text ?? "");
    } catch {
      setError("The Navigator couldn't be reached.");
    } finally {
      setPending(null);
    }
  }

  async function draftFollowUp() {
    setError(null);
    setPending("draft-follow-up");
    setDraft("");
    try {
      const res = await fetch("/api/navigator", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ task: "draft-follow-up", voyageId }),
      });

      // No-key (or other non-stream) responses come back as JSON.
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as { text?: string; error?: string };
        if (data.error) setError(data.error);
        if (data.text) setDraft(data.text);
        return;
      }
      if (!res.ok || !res.body) {
        setError("The Navigator couldn't draft a follow-up.");
        return;
      }

      // Stream the draft into the textarea as it arrives.
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setDraft(acc);
      }
    } catch {
      setError("The Navigator couldn't be reached.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="border-brass/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brass/15 text-brass">
            <Compass className="h-5 w-5" />
          </span>
          <div>
            <CardTitle className="text-xl">The Navigator</CardTitle>
            <CardDescription>Your AI co-pilot for this voyage.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Reading the tides — deal-health score. */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Reading the tides
            </p>
            <Badge variant={TIDES_BADGE[tides.accent]}>{tides.band}</Badge>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold leading-none tabular-nums">
              {tides.score}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {tides.rationale}
          </p>
        </div>

        {/* Next best action. */}
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-brass" />
            Next best action
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{nextAction}</p>
        </div>

        {!configured ? (
          <p className="rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
            Live drafting and summaries are becalmed — set{" "}
            <code className="font-mono">AI_GATEWAY_API_KEY</code> to let the
            Navigator generate text. The tides reading and next action above
            work without a key.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={summarise}
            disabled={pending !== null}
          >
            {pending === "summarise" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ScrollText className="h-4 w-4" />
            )}
            Summarise
          </Button>
          <Button
            variant="brass"
            size="sm"
            onClick={draftFollowUp}
            disabled={pending !== null}
          >
            {pending === "draft-follow-up" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PenLine className="h-4 w-4" />
            )}
            Draft follow-up
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-signal-red" role="alert">
            {error}
          </p>
        ) : null}

        {summary ? (
          <div>
            <p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">
              Summary
            </p>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {summary}
            </p>
          </div>
        ) : null}

        {draft || pending === "draft-follow-up" ? (
          <div>
            <label
              htmlFor="navigator-draft"
              className="mb-1 block text-xs uppercase tracking-wider text-muted-foreground"
            >
              Draft follow-up (editable)
            </label>
            <Textarea
              id="navigator-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              placeholder="The draft will appear here…"
              className="font-sans"
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
