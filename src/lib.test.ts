import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Application, appliedDateSchema, followupsDue, newestFirst } from "./lib.js";

// Freeze the clock so "today" and "days ago" give the same answer on every run.
// Noon UTC is still 29 October in almost every time zone.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// Build a test application with only the fields these tests care about
function app(id: number, status: Application["status"], appliedAt: string): Application {
  return { id, company: `Company ${id}`, role: "Developer", platform: "LinkedIn", status, appliedAt };
}

describe("appliedDateSchema", () => {
  it("accepts a real date in the past", () => {
    expect(appliedDateSchema.safeParse("2026-10-20").success).toBe(true);
  });

  it("rejects a date in the future", () => {
    const result = appliedDateSchema.safeParse("2026-11-05");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Date cannot be in the future");
  });

  it("rejects dates that do not exist or use the wrong format", () => {
    for (const date of ["2026-02-30", "27-10-2026", "not a date"]) {
      const result = appliedDateSchema.safeParse(date);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe("Use YYYY-MM-DD with a real date");
    }
  });
});

describe("followupsDue", () => {
  it('only includes "applied" items older than N days', () => {
    const applications = [
      app(1, "applied", "2026-10-10T00:00:00.000Z"), // 19 days, applied: due
      app(2, "replied", "2026-10-10T00:00:00.000Z"), // 19 days, but replied: not due
      app(3, "applied", "2026-10-25T00:00:00.000Z"), // 4 days: too new
      app(4, "applied", "2026-10-22T00:00:00.000Z"), // 7 days: not more than 7
    ];

    expect(followupsDue(applications, 7).map((a) => a.id)).toEqual([1]);
    expect(followupsDue(applications, 20)).toEqual([]);
  });
});

describe("newestFirst", () => {
  it("returns the highest IDs first, cut to the limit", () => {
    const applications = [
      app(1, "applied", "2026-10-01T00:00:00.000Z"),
      app(3, "applied", "2026-10-03T00:00:00.000Z"),
      app(2, "applied", "2026-10-02T00:00:00.000Z"),
      app(4, "applied", "2026-10-04T00:00:00.000Z"),
    ];

    expect(newestFirst(applications, 2).map((a) => a.id)).toEqual([4, 3]);
    expect(newestFirst(applications, 10).map((a) => a.id)).toEqual([4, 3, 2, 1]);
  });
});
