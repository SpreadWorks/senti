/**
 * src/workflow/registry.js
 *
 * Workflow command registry. Defines metadata for each subcommand:
 * - command: lazy import returning a default-exported class
 * - help: usage string
 * - args: { positional, flags, options } definitions for parseArgs
 */

export const WORKFLOW_COMMANDS = {
  add: {
    command: () => import("./lib/commands/add.js"),
    help: `Usage: sdd-forge workflow add <title> [--status Ideas|Todo] [--category RESEARCH|BUG|ENHANCE|OTHER] [--body <text>]

Create a new draft item. Title must be Japanese.`,
    args: {
      positional: ["title"],
      options: ["--status", "--category", "--body"],
    },
  },
  update: {
    command: () => import("./lib/commands/update.js"),
    help: `Usage: sdd-forge workflow update <hash> [--status <s>] [--body <text>] [--title <text>]

Update title/body/status of an existing draft item.`,
    args: {
      positional: ["hash"],
      options: ["--status", "--body", "--title"],
    },
  },
  show: {
    command: () => import("./lib/commands/show.js"),
    help: `Usage: sdd-forge workflow show <hash>

Show details of a board item by its hash ID.`,
    args: {
      positional: ["hash"],
    },
  },
  search: {
    command: () => import("./lib/commands/search.js"),
    help: `Usage: sdd-forge workflow search <query>

Full-text search board items.`,
    args: {
      positional: ["query"],
    },
  },
  list: {
    command: () => import("./lib/commands/list.js"),
    help: `Usage: sdd-forge workflow list [--status <status>]

List board items, optionally filtered by status.`,
    args: {
      options: ["--status"],
    },
  },
  publish: {
    command: () => import("./lib/commands/publish.js"),
    help: `Usage: sdd-forge workflow publish <hash> [--label <label>]

Convert a draft item to a GitHub Issue. If source/publish languages
differ, the body is translated and original is kept in a collapsed section.`,
    args: {
      positional: ["hash"],
      options: ["--label"],
    },
  },
  "issue-start": {
    command: () => import("./lib/commands/issue-start.js"),
    help: `Usage: sdd-forge workflow issue-start <issueNumber>

Move the board item linked to a GitHub issue number into "In Progress".
No-op if already In Progress; matched=false if no board item is found.
Non-fatal skip when the board / gh CLI is unavailable.`,
    args: {
      positional: ["issueNumber"],
    },
    boardOptional: true,
  },
  "issue-log-import": {
    command: () => import("./lib/commands/issue-log-import.js"),
    help: `Usage: sdd-forge workflow issue-log-import --spec <path>

Read a spec's issue-log.json and emit its entries as board-draft candidates
(JSON only, no board writes). Approval and draft creation are orchestrated by
the finalize-cleanup skill.`,
    args: {
      options: ["--spec"],
    },
    requiresBoard: false,
  },
};
