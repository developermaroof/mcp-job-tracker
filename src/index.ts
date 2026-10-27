import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Store data inside the project folder (build/../data), not the current
// working directory, because MCP clients may start the server from anywhere.
const PROJECT_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "applications.json");

const STATUSES = ["applied", "replied", "interview", "rejected", "offer"] as const;
type Status = (typeof STATUSES)[number];

interface Application {
  id: number;
  company: string;
  role: string;
  platform: string;
  url?: string;
  notes?: string;
  status: Status;
  appliedAt: string;
}

// Read all applications, creating an empty data file on first use
async function loadApplications(): Promise<Application[]> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as Application[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await saveApplications([]);
      return [];
    }
    throw error;
  }
}

async function saveApplications(applications: Application[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(applications, null, 2), "utf8");
}

// Format application data
function formatApplication(app: Application): string {
  return [
    `ID: ${app.id}`,
    `Company: ${app.company}`,
    `Role: ${app.role}`,
    `Platform: ${app.platform}`,
    `Status: ${app.status}`,
    `Applied: ${app.appliedAt.slice(0, 10)}`,
    `URL: ${app.url || "None"}`,
    `Notes: ${app.notes || "None"}`,
    "---",
  ].join("\n");
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Whole days between an ISO date and now
function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / MS_PER_DAY);
}

// Today's date as YYYY-MM-DD in the computer's local time zone
function todayLocalDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Build a server instance and register its tools. serveStdio calls this
// whenever it needs an instance, so every call must return a fresh one.
function createServer() {
  const server = new McpServer({
    name: "job-tracker",
    version: "1.0.0",
  });

  server.registerTool(
    "add_application",
    {
      description: "Add a new job application to the tracker",
      inputSchema: z.object({
        company: z.string().min(1).describe("Company name"),
        role: z.string().min(1).describe("Job title or role"),
        platform: z
          .string()
          .min(1)
          .describe("Where you applied (e.g. LinkedIn, Upwork, Rozee)"),
        url: z.string().optional().describe("Link to the job posting"),
        notes: z.string().optional().describe("Any extra notes"),
        applied_date: z.iso
          .date({ error: "Use YYYY-MM-DD with a real date", abort: true })
          .refine((date) => date <= todayLocalDate(), "Date cannot be in the future")
          .optional()
          .describe("Date you applied, YYYY-MM-DD (default today)"),
      }),
    },
    async ({ company, role, platform, url, notes, applied_date }) => {
      const applications = await loadApplications();
      const nextId = applications.reduce((max, app) => Math.max(max, app.id), 0) + 1;

      const application: Application = {
        id: nextId,
        company,
        role,
        platform,
        url,
        notes,
        status: "applied",
        // Save a given date as midnight UTC so it displays exactly as typed
        appliedAt: applied_date ? `${applied_date}T00:00:00.000Z` : new Date().toISOString(),
      };

      applications.push(application);
      await saveApplications(applications);

      return {
        content: [
          {
            type: "text",
            text: `Added application:\n\n${formatApplication(application)}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_applications",
    {
      description: "List job applications, optionally filtered by status",
      inputSchema: z.object({
        status: z
          .enum(STATUSES)
          .optional()
          .describe("Only show applications with this status"),
        limit: z
          .number()
          .int()
          .min(1)
          .default(20)
          .describe("Maximum number of applications to show, newest first (default 20)"),
      }),
    },
    async ({ status, limit }) => {
      const applications = await loadApplications();
      const matching = status
        ? applications.filter((app) => app.status === status)
        : applications;

      if (matching.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: status
                ? `No applications with status "${status}"`
                : "No applications yet",
            },
          ],
        };
      }

      // Newest first (highest ID), then keep only the first `limit`
      const shown = [...matching].sort((a, b) => b.id - a.id).slice(0, limit);

      const heading = status
        ? `Applications with status "${status}" (${matching.length}):`
        : `All applications (${matching.length}):`;
      const footer =
        shown.length < matching.length
          ? `\n\nShowing ${shown.length} of ${matching.length}. Use a status filter or a bigger limit to see more.`
          : "";

      return {
        content: [
          {
            type: "text",
            text: `${heading}\n\n${shown.map(formatApplication).join("\n")}${footer}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "update_status",
    {
      description: "Change the status of a job application",
      inputSchema: z.object({
        id: z.number().int().describe("ID of the application"),
        status: z.enum(STATUSES).describe("New status"),
      }),
    },
    async ({ id, status }) => {
      const applications = await loadApplications();
      const application = applications.find((app) => app.id === id);

      if (!application) {
        return {
          content: [
            {
              type: "text",
              text: `No application found with ID ${id}`,
            },
          ],
          isError: true,
        };
      }

      const oldStatus = application.status;
      application.status = status;
      await saveApplications(applications);

      return {
        content: [
          {
            type: "text",
            text: `Updated ${application.company} (${application.role}): ${oldStatus} -> ${status}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "followups_due",
    {
      description:
        'List applications still in "applied" status for more than N days, so you can follow up',
      inputSchema: z.object({
        days: z
          .number()
          .int()
          .min(0)
          .default(7)
          .describe("Minimum days since applying (default 7)"),
      }),
    },
    async ({ days }) => {
      const applications = await loadApplications();
      const due = applications.filter(
        (app) => app.status === "applied" && daysSince(app.appliedAt) > days,
      );

      if (due.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No follow-ups due (nothing in "applied" for more than ${days} days)`,
            },
          ],
        };
      }

      const formattedDue = due.map(
        (app) => `Waiting ${daysSince(app.appliedAt)} days\n${formatApplication(app)}`,
      );

      return {
        content: [
          {
            type: "text",
            text: `Follow-ups due (${due.length}), in "applied" for more than ${days} days:\n\n${formattedDue.join("\n")}`,
          },
        ],
      };
    },
  );

  return server;
}

serveStdio(createServer, {
  onerror: (error) => console.error("Job Tracker MCP Server error:", error),
});
console.error("Job Tracker MCP Server running on stdio");
