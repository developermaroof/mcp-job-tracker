import { z } from "zod";

export const STATUSES = ["applied", "replied", "interview", "rejected", "offer"] as const;
export type Status = (typeof STATUSES)[number];

export interface Application {
  id: number;
  company: string;
  role: string;
  platform: string;
  url?: string;
  notes?: string;
  status: Status;
  appliedAt: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole days between an ISO date and now
export function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / MS_PER_DAY);
}

// Today's date as YYYY-MM-DD in the computer's local time zone
export function todayLocalDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// A real YYYY-MM-DD date that is not in the future
export const appliedDateSchema = z.iso
  .date({ error: "Use YYYY-MM-DD with a real date", abort: true })
  .refine((date) => date <= todayLocalDate(), "Date cannot be in the future");

// Applications still in "applied" for more than `days` days
export function followupsDue(applications: Application[], days: number): Application[] {
  return applications.filter(
    (app) => app.status === "applied" && daysSince(app.appliedAt) > days,
  );
}

// Newest first (highest ID), then keep only the first `limit`
export function newestFirst(applications: Application[], limit: number): Application[] {
  return [...applications].sort((a, b) => b.id - a.id).slice(0, limit);
}
