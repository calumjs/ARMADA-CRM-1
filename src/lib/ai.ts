/**
 * Server-side AI wrapper for the Navigator.
 *
 * This is the *only* module that touches the Vercel AI SDK and the live model.
 * It is server-only by convention — only imported from the route handler, never
 * from a client component (the AI Gateway key must never reach the browser). It
 * reads the AI Gateway key from the environment and degrades gracefully: when
 * no key is configured it returns a typed "no key" result rather than throwing,
 * so the build and CI stay green without any AI key set.
 *
 * Models are addressed with a plain `"provider/model"` AI Gateway string (see
 * `NAVIGATOR_MODEL`), not a provider-specific SDK package.
 */

import { generateText, streamText } from "ai";

import {
  NAVIGATOR_MODEL,
  NO_KEY_MESSAGE,
  SYSTEM_PROMPT,
  hasGatewayKey,
} from "./navigator";

/** The typed result of a non-streamed navigator call. */
export type AiResult =
  | { ok: true; text: string }
  | { ok: false; error: string; code: "no-key" | "failed" };

/**
 * Run a single, non-streamed completion for the given prompt. Returns a typed
 * result — it never throws for the no-key case (it degrades), and converts live
 * failures into a typed error rather than a 500 with a stack trace.
 */
export async function runNavigator(prompt: string): Promise<AiResult> {
  if (!hasGatewayKey()) {
    return { ok: false, error: NO_KEY_MESSAGE, code: "no-key" };
  }
  try {
    const { text } = await generateText({
      model: NAVIGATOR_MODEL,
      system: SYSTEM_PROMPT,
      prompt,
      maxOutputTokens: 600,
    });
    return { ok: true, text: text.trim() };
  } catch (err) {
    console.error("[navigator] generateText failed:", err);
    return {
      ok: false,
      error: "The Navigator hit rough seas. Try again shortly.",
      code: "failed",
    };
  }
}

/**
 * Stream a completion for the given prompt as a `text/plain` streaming Response,
 * for the editable "Draft follow-up" flow. Returns `null` when there's no key,
 * so the caller can answer with a graceful non-streamed message instead.
 */
export function streamNavigator(prompt: string): Response | null {
  if (!hasGatewayKey()) return null;
  const result = streamText({
    model: NAVIGATOR_MODEL,
    system: SYSTEM_PROMPT,
    prompt,
    maxOutputTokens: 600,
    onError: ({ error }) => {
      console.error("[navigator] streamText failed:", error);
    },
  });
  return result.toTextStreamResponse();
}
