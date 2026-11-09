---
name: job-tracker
description: Tracks the user's job applications with the job-tracker MCP server. Adds new applications, lists them by status, updates a status (applied, replied, interview, rejected, offer) and finds applications that need a follow-up. Use when the user mentions applying to a job or sending a proposal (for example on LinkedIn, Upwork or Rozee), hearing back from a company, getting an interview, a rejection or an offer, wants to see or track their job applications, or asks who to follow up with in their job search.
license: MIT
compatibility: Requires the job-tracker MCP server (https://github.com/developermaroof/mcp-job-tracker) running locally on Node.js 20 or newer and connected to the agent, for example in Claude Desktop or Claude Code.
metadata:
  author: Maroof Qureshi
  version: "1.0.0"
  repository: https://github.com/developermaroof/mcp-job-tracker
---

# Job Tracker

This skill keeps a record of the user's job applications through the job-tracker MCP server. The server has four tools: `add_application`, `list_applications`, `update_status` and `followups_due`. It stores everything in one JSON file on the user's computer (`data/applications.json` in the server folder).

The server does not search for jobs, apply to jobs, send messages or set reminders. It only records what the user tells you.

If the server was added under the name `job-tracker`, Claude Code shows the tools with a prefix, for example `mcp__job-tracker__add_application`.

## When to use this skill

Use it when the user:

- says they applied to a job or sent a proposal
- tells you a company replied, invited them to an interview, rejected them or made an offer
- asks to see their applications, or only the ones with a certain status
- asks who to follow up with, or which applications have had no reply for a while

If the job-tracker tools are not available, tell the user the server is not connected and point them to the Setup section below. Never say an application was saved unless a tool call returned it.

## Statuses

The server accepts exactly these five values. The meanings below are guidance for choosing one; the server only stores the word.

| Status | Use it when |
|---|---|
| `applied` | The application was sent and there is no answer yet. New applications start here. |
| `replied` | The company answered, but there is no interview yet. |
| `interview` | An interview or call is planned or has happened. |
| `rejected` | The company said no. |
| `offer` | The company made an offer. |

## Tools

### add_application

Saves a new application with the status `applied`. Its ID is the highest existing ID plus 1.

| Input | Required | Rules |
|---|---|---|
| `company` | Yes | Text, not empty |
| `role` | Yes | Text, not empty |
| `platform` | Yes | Where the user applied, for example LinkedIn, Upwork or Rozee |
| `url` | No | Link to the job posting |
| `notes` | No | Any extra notes |
| `applied_date` | No | `YYYY-MM-DD`. Must be a real date and not in the future. If left out, the server uses the current date and time. |

How to use it:

- If company, role or platform is missing, ask the user. Do not guess.
- If the user applied on an earlier day ("yesterday", "last Monday"), convert it to `YYYY-MM-DD` and pass it as `applied_date`. Follow-ups are counted from this date. If they applied today, leave it out.
- The server does not check for duplicates. If the user may have saved this application before, call `list_applications` first.
- After saving, tell the user the new ID.
- A badly formatted or impossible date returns the error "Use YYYY-MM-DD with a real date". A future date returns "Date cannot be in the future", checked against the date on the computer that runs the server. Nothing is saved when a call returns an error.

### list_applications

Lists applications, newest first (highest ID first). Each result shows the ID, company, role, platform, status, applied date, URL and notes.

| Input | Required | Rules |
|---|---|---|
| `status` | No | One of the five statuses. One status per call. |
| `limit` | No | Whole number, 1 or more. Default 20. |

How to use it:

- If more applications match than the limit, the last line says "Showing X of Y. Use a status filter or a bigger limit to see more." If the user wants all of them, call it again with a bigger `limit`.
- With nothing to show, it returns "No applications yet" or "No applications with status" followed by the status.
- There is no search by company or role. To find an application, list them and read the results.

### update_status

Changes the status of one application.

| Input | Required | Rules |
|---|---|---|
| `id` | Yes | Whole number, the application's ID |
| `status` | Yes | One of the five statuses |

How to use it:

- The tool needs the ID. When the user names a company instead, call `list_applications` first and find the ID. If more than one application matches, for example two roles at the same company, ask which one.
- It returns "Updated <company> (<role>): <old status> -> <new status>". An unknown ID returns the error "No application found with ID <id>".
- Only the status changes. The applied date stays the same.

### followups_due

Lists applications that are still `applied` after more than a number of days.

| Input | Required | Rules |
|---|---|---|
| `days` | No | Whole number, 0 or more. Default 7. |

How to use it:

- It returns applications whose status is `applied` and whose applied date is more than `days` full days ago, each with a "Waiting N days" line. Applications with any other status never appear.
- Turn the user's words into `days`: "more than two weeks" is 14, "over a month" is 30.
- The server does not record that a follow-up was sent. An application keeps appearing until its status changes, so when the user hears back, update the status.

## What the server cannot do

- Delete an application.
- Change the company, role, platform, URL, notes or applied date after saving. Only the status can change.
- Search by company or role, or filter by more than one status at once.
- Send reminders, messages or emails.

If the user asks for one of these, say so plainly. To fix or remove a record, the user can edit `data/applications.json` in the server folder by hand.

## Examples

### Example 1: Saving a new application

User: I applied yesterday for a Next.js Developer job at Brightline Labs on Upwork. Link: https://www.upwork.com/jobs/~0123456789

Today is 2026-11-09, so yesterday is 2026-11-08. Call `add_application`:

```json
{"company": "Brightline Labs", "role": "Next.js Developer", "platform": "Upwork", "url": "https://www.upwork.com/jobs/~0123456789", "applied_date": "2026-11-08"}
```

Result (shortened):

```
Added application:

ID: 3
Company: Brightline Labs
Role: Next.js Developer
Platform: Upwork
Status: applied
Applied: 2026-11-08
```

Assistant: Saved as application 3, with the status "applied" and the date 2026-11-08.

### Example 2: Updating a status by company name

User: Globex just invited me to an interview!

The user named a company, not an ID. Call `list_applications` with `{}` and find Globex in the result:

```
ID: 2
Company: Globex
Role: React Developer
Platform: Upwork
Status: replied
```

There is only one Globex application, so call `update_status`:

```json
{"id": 2, "status": "interview"}
```

Result:

```
Updated Globex (React Developer): replied -> interview
```

Assistant: Congratulations! Globex (React Developer) is now marked as "interview".

### Example 3: Finding follow-ups

User: Which applications have had no reply for more than two weeks?

Call `followups_due`:

```json
{"days": 14}
```

Result (shortened):

```
Follow-ups due (1), in "applied" for more than 14 days:

Waiting 19 days
ID: 1
Company: Acme Corp
Role: Frontend Developer
Platform: LinkedIn
Status: applied
Applied: 2026-10-21
```

Assistant: One application: Acme Corp, Frontend Developer on LinkedIn. You applied on 2026-10-21, 19 days ago, and it is still marked "applied", so this is a good time for a short follow-up. When they answer, tell me and I will update the status.

## Setup

This skill only contains instructions. The tools come from the job-tracker MCP server, which must be installed and connected first. It needs Node.js 20 or newer and npm.

### 1. Install and build the server

```bash
git clone https://github.com/developermaroof/mcp-job-tracker.git
cd mcp-job-tracker
npm install
npm run build
```

This creates `build/index.js`. The server saves data in `data/applications.json` inside this folder and creates the file on first use.

### 2a. Connect it to Claude Desktop

In Claude Desktop, open Settings > Developer > Edit Config. This opens `claude_desktop_config.json` (on Windows: `%APPDATA%\Claude\claude_desktop_config.json`). Add the server inside `mcpServers`:

```json
{
  "mcpServers": {
    "job-tracker": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\path\\to\\mcp-job-tracker\\build\\index.js"]
    }
  }
}
```

Replace `C:\\path\\to\\mcp-job-tracker` with the folder where you cloned the project. Then fully quit Claude Desktop: closing the window is not enough, because it keeps running in the system tray. Right-click the Claude icon in the system tray, choose Quit, and open Claude Desktop again.

Notes for Windows:

- Every backslash in the JSON file must be doubled (`\\`), or the config will not load.
- Use the full path to `node.exe`, not just `node`. To find it, run `where.exe node` in a terminal and use the path it prints, with the backslashes doubled.
- If `mcpServers` already has other servers, put a comma after the closing `}` of the entry before this one. Do not put a comma after the last entry.

On macOS the config file is at `~/Library/Application Support/Claude/claude_desktop_config.json`, and paths use forward slashes, for example `/Users/you/mcp-job-tracker/build/index.js`.

### 2b. Connect it to Claude Code

macOS or Linux:

```bash
claude mcp add --scope user job-tracker -- node /path/to/mcp-job-tracker/build/index.js
```

Windows (PowerShell or Command Prompt):

```powershell
claude mcp add --scope user job-tracker -- node "C:\path\to\mcp-job-tracker\build\index.js"
```

- `--scope user` makes the server available in all your projects. Without it, the default scope `local` adds it to the current project only.
- Everything after `--` is the command that starts the server. On the command line, use normal single backslashes. Claude Code writes them correctly into its own config.
- To check it, run `claude mcp list`. It should show `job-tracker` as Connected. Inside Claude Code, `/mcp` shows the server status.

### 3. Try it

Ask: "Show my job applications." On a fresh install the answer is "No applications yet".
