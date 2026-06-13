/**
 * src/lib/command-registry.js
 *
 * Unified command registry. Every CLI subcommand (flow / docs / check /
 * metrics) is declared here as a tree. Each dispatcher imports only the
 * subtree it needs via named exports (e.g. `flowCommands`), while static
 * checks and tests import the combined `allCommands` root.
 *
 * An entry shape:
 *
 *   {
 *     metadata?: CommandHelpMetadata,
 *     help?: string,
 *     args?: { flags?, options?, positional? },
 *     command: () => Promise<{ default: typeof Command }>,
 *     outputMode: "envelope" | "raw",
 *     passthroughArgs?: boolean,
 *     pre?, post?, onError?,
 *   }
 *
 * Help metadata convention:
 *   Metadata must be import-safe. Command implementation modules may have
 *   import-time side effects, so help rendering reads only this registry
 *   metadata and must not call `command()` or import command modules.
 */

import { FLOW_COMMANDS } from "../flow/registry.js";

export class CommandHelpMetadata {
  constructor({
    name,
    section = "",
    summary = "",
    usage = "",
    args = {},
    options = [],
    experimental = false,
    localeKey = null,
    locale = null,
    owner = "core-command-metadata",
    subcommands = [],
  }) {
    if (typeof name !== "string" || name.trim() === "") {
      throw new Error("command help metadata requires a non-empty name");
    }
    this.name = name;
    this.section = section;
    this.summary = summary;
    this.usage = usage || `Usage: senti ${name}`;
    this.args = args && typeof args === "object" ? args : {};
    this.options = Array.isArray(options) ? options : [];
    this.experimental = Boolean(experimental);
    this.localeKey = localeKey || null;
    this.locale = locale || null;
    this.owner = owner;
    this.subcommands = subcommands.map((entry) => entry instanceof CommandHelpMetadata
      ? entry
      : new CommandHelpMetadata({ ...entry, owner }));
  }

  find(parts) {
    const [head, ...rest] = parts;
    if (!head) return this;
    const sub = this.subcommands.find((entry) => entry.name.split(" ").at(-1) === head || entry.name === [this.name, head].join(" "));
    return rest.length === 0 ? sub : sub?.find(rest);
  }

  all() {
    return [this, ...this.subcommands.flatMap((entry) => entry.all())];
  }
}

export class CoreCommandMetadataRegistry {
  constructor(entries) {
    this.entries = entries.map((entry) => entry instanceof CommandHelpMetadata ? entry : new CommandHelpMetadata(entry));
  }

  findCommand(parts) {
    const normalized = Array.isArray(parts) ? parts : String(parts).split(/\s+/);
    const [head, ...rest] = normalized;
    const top = this.entries.find((entry) => entry.name === head);
    if (!top) return null;
    return rest.length === 0 ? top : top.find(rest);
  }

  topLevelCommands() {
    return this.entries.flatMap((entry) => entry.subcommands.length ? entry.subcommands : [entry]);
  }

  allCommands() {
    return this.entries.flatMap((entry) => entry.all());
  }
}

const docsSubcommandDefinitions = [
  ["build", "Generate docs (scan → enrich → init → data → text → readme)", "Usage: senti docs build [options]", "ui:help.commands.docs build"],
  ["scan", "Source code analysis → analysis.json", "Usage: senti docs scan [options]", "ui:help.commands.docs scan"],
  ["enrich", "Enrich analysis entries with AI (summary/detail/chapter)", "Usage: senti docs enrich [options]", "ui:help.commands.docs enrich"],
  ["init", "Initialize docs/ from templates", "Usage: senti docs init [options]", "ui:help.commands.docs init"],
  ["data", "Resolve {{data}} directives with analysis data", "Usage: senti docs data [options]", "ui:help.commands.docs data"],
  ["text", "Resolve {{text}} directives with AI", "Usage: senti docs text --agent <name> [options]", "ui:help.commands.docs text"],
  ["readme", "Auto-generate README.md", "Usage: senti docs readme [options]", "ui:help.commands.docs readme"],
  ["forge", "Iterative docs improvement (AI agent)", "Usage: senti docs forge --prompt \"...\" [options]", "ui:help.commands.docs forge"],
  ["review", "Docs quality check", "Usage: senti docs review [<docs-dir>]", "ui:help.commands.docs review"],
  ["translate", "Translate docs to non-default languages", "Usage: senti docs translate [options]", "ui:help.commands.docs translate"],
  ["changelog", "Generate change_log.md from specs/", "Usage: senti docs changelog [--dry-run] [<output-file>]", "ui:help.commands.docs changelog"],
  ["agents", "Update AGENTS.md PROJECT section", "Usage: senti docs agents [--dry-run]", "ui:help.commands.docs agents"],
  ["snapshot", "Save/check docs snapshot for change detection", "Usage: senti docs snapshot [options]", "ui:help.commands.docs snapshot"],
];

const docsCommandOptions = {
  init: ["--type <type>", "--force", "--dry-run", "-h, --help"],
  scan: ["--reset [cats]", "--stdout", "--dry-run", "-h, --help"],
  text: ["--agent <name>", "--id <id>", "--dry-run", "--per-directive", "--timeout <ms>", "-h, --help"],
};

const docsCommandArgs = {
  init: { flags: ["--force", "--dry-run"], options: ["--type"] },
  scan: { flags: ["--stdout", "--dry-run"], options: ["--reset"] },
  text: { flags: ["--dry-run", "--per-directive"], options: ["--agent", "--id", "--timeout"] },
};

const docsSubcommands = docsSubcommandDefinitions.map(([name, summary, usage, localeKey]) => new CommandHelpMetadata({
  name: `docs ${name}`,
  section: "Docs",
  summary,
  usage,
  args: docsCommandArgs[name] || { flags: ["-h", "--help"] },
  options: docsCommandOptions[name] || ["-h, --help"],
  localeKey,
}));

function flowHelpSummary(help, fallback) {
  const lines = String(help || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => !line.startsWith("Usage:")) || fallback;
}

function flowHelpOptions(help) {
  const lines = String(help || "").split(/\r?\n/);
  const index = lines.findIndex((line) => line.trim() === "Options:");
  if (index < 0) return ["-h, --help"];
  const options = lines.slice(index + 1).map((line) => line.trim()).filter(Boolean);
  return options.length ? options : ["-h, --help"];
}

const flowRunSubcommands = Object.entries(FLOW_COMMANDS.run || {}).map(([name, entry]) => new CommandHelpMetadata({
  name: `flow run ${name}`,
  section: "Flow",
  summary: flowHelpSummary(entry.help, `Run ${name}`),
  usage: String(entry.help || "").split(/\r?\n/, 1)[0] || `Usage: senti flow run ${name} [options]`,
  args: entry.args || {},
  options: flowHelpOptions(entry.help),
  localeKey: entry.helpKey ? `ui:${entry.helpKey}` : null,
}));

const flowSubcommands = [
  ["get", "Read flow state (status, check, prompt, guardrail, ...)", "Usage: senti flow get <key> [options]", "ui:help.commands.flow get"],
  ["set", "Update flow state (step, req, note, metric, ...)", "Usage: senti flow set <key> [options]", "ui:help.commands.flow set"],
  ["run", "Execute flow actions (prepare-spec, gate, finalize, ...)", "Usage: senti flow run <action> [options]", "ui:help.commands.flow run"],
].map(([name, summary, usage, localeKey]) => new CommandHelpMetadata({
  name: `flow ${name}`,
  section: "Flow",
  summary,
  usage,
  args: { flags: ["-h", "--help"], options: ["--agent-work-dir"] },
  options: ["-h, --help", "--agent-work-dir <path>"],
  localeKey,
  subcommands: name === "run" ? flowRunSubcommands : [],
}));

export const coreCommandMetadataRegistry = new CoreCommandMetadataRegistry([
  {
    name: "help",
    section: "Project",
    summary: "Show this help",
    usage: "Usage: senti help [command]",
    args: { positional: ["command"] },
    options: ["-h, --help"],
    localeKey: "ui:help.commands.help",
  },
  {
    name: "setup",
    section: "Project",
    summary: "Register project + generate config (interactive)",
    usage: "Usage: senti setup",
    args: {},
    options: ["-h, --help"],
    localeKey: "ui:help.commands.setup",
  },
  {
    name: "upgrade",
    section: "Project",
    summary: "Update template-derived files to latest version",
    usage: "Usage: senti upgrade [--dry-run]",
    args: { flags: ["--dry-run"] },
    options: ["--dry-run", "-h, --help"],
    localeKey: "ui:help.commands.upgrade",
  },
  {
    name: "plugin",
    section: "Project",
    summary: "Manage plugin sources, packages, commands, and presets",
    usage: "Usage: senti plugin <command> [options]",
    args: { positional: ["command"], rest: "args" },
    options: ["-h, --help"],
    localeKey: "ui:help.commands.plugin",
  },
  {
    name: "docs",
    section: "Docs",
    summary: "Documentation commands",
    usage: "Usage: senti docs <command> [options]",
    args: { positional: ["command"], rest: "args" },
    options: ["-h, --help"],
    localeKey: "ui:help.commands.docs build",
    subcommands: docsSubcommands,
  },
  {
    name: "flow",
    section: "Flow",
    summary: "Spec-Driven Development flow commands",
    usage: "Usage: senti flow <command> [options]",
    args: { positional: ["command"], rest: "args" },
    options: ["-h, --help"],
    localeKey: "ui:help.commands.flow run",
    subcommands: flowSubcommands,
  },
  {
    name: "metrics",
    section: "Metrics",
    summary: "Metrics commands",
    usage: "Usage: senti metrics <command> [options]",
    args: { positional: ["command"], rest: "args" },
    options: ["-h, --help"],
    localeKey: "ui:help.commands.metrics token",
    subcommands: [
      new CommandHelpMetadata({
        name: "metrics token",
        section: "Metrics",
        summary: "Aggregate and display token/cache/cost metrics",
        usage: "Usage: senti metrics token [options]",
        args: { flags: ["-h", "--help"] },
        options: ["-h, --help"],
        localeKey: "ui:help.commands.metrics token",
      }),
    ],
  },
  {
    name: "presets",
    section: "Info",
    summary: "Preset commands",
    usage: "Usage: senti presets <command>",
    args: { positional: ["command"] },
    options: ["-h, --help"],
    localeKey: "ui:help.commands.presets list",
    subcommands: [
      new CommandHelpMetadata({
        name: "presets list",
        section: "Info",
        summary: "Show preset inheritance tree",
        usage: "Usage: senti presets list",
        args: {},
        options: ["-h, --help"],
        localeKey: "ui:help.commands.presets list",
      }),
    ],
  },
  {
    name: "hook",
    section: "Info",
    summary: "Hook commands",
    usage: "Usage: senti hook <command>",
    args: { positional: ["command"] },
    options: ["-h, --help"],
    localeKey: "ui:help.commands.hook",
    subcommands: [
      new CommandHelpMetadata({
        name: "hook list",
        section: "Info",
        summary: "List available flow hooks and current configured commands.",
        usage: "Usage: senti hook list [--json]",
        args: { flags: ["--json"] },
        options: ["--json", "-h, --help"],
        localeKey: "ui:help.commands.hook list",
      }),
    ],
  },
]);

// ---------------------------------------------------------------------------
// flow subtree — re-use FLOW_COMMANDS and attach outputMode: "envelope".
// ---------------------------------------------------------------------------

function decorateFlowEntry(entry) {
  if (entry && typeof entry.command === "function") {
    return { ...entry, outputMode: "envelope" };
  }
  if (entry && typeof entry === "object") {
    const out = {};
    for (const [k, v] of Object.entries(entry)) out[k] = decorateFlowEntry(v);
    return out;
  }
  return entry;
}

export const flowCommands = decorateFlowEntry(FLOW_COMMANDS);

// ---------------------------------------------------------------------------
// Helpers for raw-output commands. Each command's args are parsed internally
// by the command (via `parseArgs(ctx._rawArgs, ...)`), so the registry
// declares `passthroughArgs: true` rather than a full `args` spec.
// ---------------------------------------------------------------------------

function rawEntry(modulePath) {
  return {
    command: () => import(modulePath),
    outputMode: "raw",
    passthroughArgs: true,
  };
}

// ---------------------------------------------------------------------------
// docs subtree
// ---------------------------------------------------------------------------

export const docsCommands = {
  build:     rawEntry("../docs/commands/build.js"),
  scan:      rawEntry("../docs/commands/scan.js"),
  enrich:    rawEntry("../docs/commands/enrich.js"),
  init:      rawEntry("../docs/commands/init.js"),
  data:      rawEntry("../docs/commands/data.js"),
  text:      rawEntry("../docs/commands/text.js"),
  readme:    rawEntry("../docs/commands/readme.js"),
  forge:     rawEntry("../docs/commands/forge.js"),
  review:    rawEntry("../docs/commands/review.js"),
  changelog: rawEntry("../docs/commands/changelog.js"),
  agents:    rawEntry("../docs/commands/agents.js"),
  translate: rawEntry("../docs/commands/translate.js"),
};

// ---------------------------------------------------------------------------
// check subtree
// ---------------------------------------------------------------------------

export const checkCommands = {
  config:    rawEntry("../check/commands/config.js"),
  freshness: rawEntry("../check/commands/freshness.js"),
  scan:      rawEntry("../check/commands/scan.js"),
};

// ---------------------------------------------------------------------------
// metrics subtree
// ---------------------------------------------------------------------------

export const metricsCommands = {
  token: rawEntry("../metrics/commands/token.js"),
  review: rawEntry("../metrics/commands/review.js"),
};

// ---------------------------------------------------------------------------
// spec subtree
// ---------------------------------------------------------------------------

export const specCommands = {
  render: rawEntry("../spec/commands/render.js"),
};

// ---------------------------------------------------------------------------
// hook subtree
// ---------------------------------------------------------------------------

export const hookCommands = {
  list: {
    command: () => import("../hook/commands/list.js"),
    outputMode: "raw",
    args: { flags: ["--json"] },
    help: [
      "Usage: senti hook list [--json]",
      "",
      "List available flow hooks and current configured commands.",
      "",
      "Options:",
      "  --json    Output structured JSON",
    ].join("\n"),
  },
};

// ---------------------------------------------------------------------------
// Unified root
// ---------------------------------------------------------------------------

export const allCommands = {
  flow: flowCommands,
  docs: docsCommands,
  check: checkCommands,
  metrics: metricsCommands,
  spec: specCommands,
  hook: hookCommands,
};
