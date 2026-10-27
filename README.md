# mcp-job-tracker

An MCP server that lets Claude track your job applications. You tell Claude about an application, and it saves it in a local JSON file on your computer. You can then list your applications, update their status and see which ones need a follow-up. There is no database and no account to set up.

## Tools

- `add_application` saves a new application with the status `applied`.
- `list_applications` lists your applications, newest first. If some are hidden by the limit, the last line says how many.
- `update_status` changes the status of one application.
- `followups_due` lists applications that are still `applied` after a number of days, so you know who to follow up with.

The possible statuses are `applied`, `replied`, `interview`, `rejected` and `offer`.

| Tool | Input | Required | Description |
|---|---|---|---|
| `add_application` | `company` | Yes | Company name |
| | `role` | Yes | Job title or role |
| | `platform` | Yes | Where you applied, for example LinkedIn, Upwork or Rozee |
| | `url` | No | Link to the job posting |
| | `notes` | No | Any extra notes |
| | `applied_date` | No | Date you applied, as `YYYY-MM-DD`. Must be a real date and not in the future. Default: today. |
| `list_applications` | `status` | No | Only show applications with this status |
| | `limit` | No | How many applications to show, newest first. Whole number, at least 1. Default: 20. |
| `update_status` | `id` | Yes | ID of the application |
| | `status` | Yes | The new status |
| `followups_due` | `days` | No | Show applications still in `applied` for more than this many days. Default: 7. |

## Requirements

- Node.js 20 or newer (required by the MCP TypeScript SDK, `@modelcontextprotocol/server`)
- npm (installed with Node.js)
- Claude Desktop, or another MCP client that can start a stdio server

## Install and build

```bash
git clone https://github.com/developermaroof/mcp-job-tracker.git
cd mcp-job-tracker
npm install
npm run build
```

`npm run build` runs the TypeScript compiler (`tsc`) and writes the JavaScript output to `build/`. Run it again after every change to `src/index.ts`.

## Connect to Claude Desktop

1. In Claude Desktop, open Settings > Developer > Edit Config. This opens `claude_desktop_config.json`. On Windows the file is at `%APPDATA%\Claude\claude_desktop_config.json`.

2. Add the server inside `mcpServers`:

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

   Replace `C:\\path\\to\\mcp-job-tracker` with the folder where you cloned the project.

3. Fully quit Claude Desktop and open it again. Closing the window is not enough, because Claude Desktop keeps running in the system tray. Right-click the Claude icon in the system tray (bottom right of the taskbar), choose Quit, then start Claude Desktop again.

Notes for Windows:

- Every backslash in the JSON file must be doubled (`\\`). A single backslash is an escape character in JSON, and the config will not load.
- Use the full path to `node.exe`, not just `node`. Claude Desktop does not always see the same PATH as your terminal. To find the path, run `where.exe node` in a terminal and use the path it prints, with the backslashes doubled.
- If `mcpServers` already has other servers, put a comma after the closing `}` of the entry before this one. Do not put a comma after the last entry.

On macOS the config file is at `~/Library/Application Support/Claude/claude_desktop_config.json`, and paths use forward slashes, for example `/Users/you/mcp-job-tracker/build/index.js`.

If the tools do not show up, check the log files in `%APPDATA%\Claude\logs` on Windows or `~/Library/Logs/Claude` on macOS.

## Example prompts

- "Add a job application: Frontend Developer at Acme Corp on LinkedIn, link https://example.com/jobs/123."
- "I applied to Globex for a React Developer role on Upwork on 2026-10-20. Add it."
- "Show my job applications."
- "Show my last 5 applications."
- "Show only the applications where I have an interview."
- "Globex replied to me. Update application 2 to replied."
- "Which applications need a follow-up?"
- "Which applications have had no reply for more than 14 days?"

## How it works

- **stdio transport.** Claude Desktop starts the server as a child process (`node build/index.js`) and talks to it through standard input and standard output. Each message is a JSON-RPC message on its own line. There is no network port and no web server.
- **zod validation.** Every tool describes its inputs with a zod schema. The MCP SDK turns these schemas into JSON Schema so Claude knows which inputs each tool takes, and it checks every call against the schema before the tool code runs. Invalid input, such as a missing `role`, an unknown status or a date in the future, is rejected with an error message and nothing is saved.
- **Never use console.log.** In a stdio server, stdout is used only for protocol messages. `console.log` writes to stdout, so any log line would get mixed into the messages, the client would not be able to read them, and the connection can break. Use `console.error` instead. It writes to stderr, which Claude Desktop saves in its log files.
- **Storage.** Applications are saved in `data/applications.json` inside the project folder. The path is worked out from the location of `build/index.js`, not from the current working directory, because Claude Desktop can start the server from any folder. The `data` folder and the file are created automatically on the first tool call. Each new application gets the next free ID number. The file is listed in `.gitignore`, so your job search data is never committed.

## Project structure

```
mcp-job-tracker/
  src/
    index.ts            Server code: storage helpers and the 4 tools
  build/                Compiled JavaScript, created by npm run build (not in git)
  data/
    applications.json   Your saved applications, created on first use (not in git)
  .gitignore
  package.json          Dependencies and the build script
  package-lock.json     Exact dependency versions
  tsconfig.json         TypeScript compiler settings
  README.md
```

## License

MIT. See [LICENSE](LICENSE).

---

Built by Maroof Qureshi

[developermaroof.com](https://developermaroof.com)
