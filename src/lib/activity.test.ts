import { describe, expect, it } from "vitest";

import {
  activitySchema,
  isOverdue,
  sortTasksByDue,
  toTimelineActivity,
} from "./activity";

describe("activitySchema", () => {
  it("accepts a note logged against a port", () => {
    const parsed = activitySchema.safeParse({
      type: "NOTE",
      subject: "Intro call",
      body: "",
      portId: "port-1",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.body).toBeNull(); // blank → null
    expect(parsed.data.dueAt).toBeNull();
  });

  it("rejects an activity with no target", () => {
    const parsed = activitySchema.safeParse({
      type: "TASK",
      subject: "Follow up",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a blank subject", () => {
    const parsed = activitySchema.safeParse({
      type: "NOTE",
      subject: "  ",
      voyageId: "v-1",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.flatten().fieldErrors.subject?.length).toBeGreaterThan(
      0,
    );
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-06-07T12:00:00Z");

  it("flags an open task whose due date is in the past", () => {
    expect(isOverdue({ done: false, dueAt: "2026-06-01" }, now)).toBe(true);
  });

  it("does not flag a task due today", () => {
    expect(isOverdue({ done: false, dueAt: "2026-06-07" }, now)).toBe(false);
  });

  it("never flags a completed task", () => {
    expect(isOverdue({ done: true, dueAt: "2026-01-01" }, now)).toBe(false);
  });

  it("never flags a task with no due date", () => {
    expect(isOverdue({ done: false, dueAt: null }, now)).toBe(false);
  });
});

describe("sortTasksByDue", () => {
  it("orders by due date ascending with no-due tasks last", () => {
    const tasks = [
      { id: "a", dueAt: "2026-06-10", createdAt: "2026-06-01" },
      { id: "b", dueAt: null, createdAt: "2026-06-01" },
      { id: "c", dueAt: "2026-06-05", createdAt: "2026-06-01" },
    ];
    expect(sortTasksByDue(tasks).map((t) => t.id)).toEqual(["c", "a", "b"]);
  });

  it("keeps no-due tasks last even when sorting descending", () => {
    const tasks = [
      { id: "a", dueAt: "2026-06-10", createdAt: "2026-06-01" },
      { id: "b", dueAt: null, createdAt: "2026-06-01" },
      { id: "c", dueAt: "2026-06-05", createdAt: "2026-06-01" },
    ];
    expect(sortTasksByDue(tasks, "desc").map((t) => t.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
});

describe("toTimelineActivity", () => {
  it("serialises dates and derives the author name", () => {
    const out = toTimelineActivity({
      id: "1",
      type: "TASK",
      subject: "Send proposal",
      body: null,
      occurredAt: new Date("2026-06-07T00:00:00Z"),
      done: false,
      dueAt: new Date("2026-06-09T00:00:00Z"),
      captain: { firstName: "Ada", lastName: "Vance" },
    });
    expect(out.author).toBe("Ada Vance");
    expect(out.dueAt).toBe("2026-06-09T00:00:00.000Z");
    expect(out.type).toBe("TASK");
  });

  it("leaves the author null when there is no captain", () => {
    const out = toTimelineActivity({
      id: "2",
      type: "NOTE",
      subject: "Logged a note",
      body: "Body",
      occurredAt: "2026-06-07T00:00:00.000Z",
      done: true,
      dueAt: null,
      captain: null,
    });
    expect(out.author).toBeNull();
    expect(out.dueAt).toBeNull();
  });
});
