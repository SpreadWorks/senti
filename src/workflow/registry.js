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
};
