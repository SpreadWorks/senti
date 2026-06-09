#!/usr/bin/env node
/**
 * src/workflow/index.js
 *
 * Workflow CLI dispatcher (senti workflow <subcommand>). Loads senti
 * config, parses subcommand args via the registry, and dispatches to a command
 * class implementing execute(ctx).
 *
 * [EXPERIMENTAL]: the implementation is stable but the usage methodology is not
 * finalized. See src/workflow/AGENTS.md for the graduation criteria.
 *
 * Output: JSON envelope ({ ok, type, key, data, errors }).
 *
 * Routing:
 *   senti workflow <subcommand> [args]
 *   senti workflow add "タイトル" --category BUG
 *   senti workflow publish <hash> --label enhancement
 */

import { repoRoot, parseArgs } from "../lib/cli.js";
import { loadConfig } from "../lib/config.js";
import { initContainer } from "../lib/container.js";
import { Envelope } from "../lib/flow-envelope.js";
import { EXIT_ERROR, EXIT_SUCCESS } from "../lib/constants.js";
import { WORKFLOW_COMMANDS } from "./registry.js";
import { loadBoardConfig } from "./lib/config.js";

function printHelp() {
  const lines = [
    "[EXPERIMENTAL] senti workflow — usage patterns may change.",
    "",
    "Usage: senti workflow <subcommand> [args]",
    "",
    "Subcommands:",
  ];
  for (const name of Object.keys(WORKFLOW_COMMANDS)) {
    lines.push(`  ${name.padEnd(10)} ${firstLine(WORKFLOW_COMMANDS[name].help)}`);
  }
  console.log(lines.join("\n"));
}

function firstLine(text) {
  return String(text).split("\n")[0].replace(/^Usage: senti workflow \w+ ?/, "");
}

function parseEntryArgs(entry, rawArgs, ctx) {
  if (!entry.args) return;

  const { positional, flags, options } = entry.args;

  if (flags || options) {
    const spec = { flags: flags || [], options: options || [] };
    const flagOptionSet = new Set([...(flags || []), ...(options || [])]);
    const nonPositional = [];
    const positionalValues = [];
    for (let i = 0; i < rawArgs.length; i++) {
      const a = rawArgs[i];
      if (a === "-h" || a === "--help") {
        nonPositional.push(a);
        continue;
      }
      if (flagOptionSet.has(a)) {
        nonPositional.push(a);
        if ((options || []).includes(a) && i + 1 < rawArgs.length) {
          nonPositional.push(rawArgs[++i]);
        }
        continue;
      }
      positionalValues.push(a);
    }
    const parsed = parseArgs(nonPositional, spec);
    Object.assign(ctx, parsed);

    if (positional && positionalValues.length > 0) {
      for (let i = 0; i < positional.length && i < positionalValues.length; i++) {
        ctx[positional[i]] = positionalValues[i];
      }
    }
  } else if (positional) {
    for (let i = 0; i < positional.length && i < rawArgs.length; i++) {
      ctx[positional[i]] = rawArgs[i];
    }
  }
}

async function dispatch() {
  const argv = process.argv.slice(2);
  const subcommand = argv[0];
  const rest = argv.slice(1);

  if (!subcommand || subcommand === "-h" || subcommand === "--help") {
    printHelp();
    process.exit(subcommand ? EXIT_SUCCESS : EXIT_ERROR);
  }

  const entry = WORKFLOW_COMMANDS[subcommand];
  if (!entry) {
    Envelope.fail("workflow", subcommand, "UNKNOWN_COMMAND", `unknown subcommand: ${subcommand}`).output();
    process.exit(EXIT_ERROR);
  }

  // Help for specific subcommand (no config required)
  if (rest[0] === "-h" || rest[0] === "--help") {
    console.log(entry.help);
    process.exit(EXIT_SUCCESS);
  }

  // Resolve project root and load config
  const root = repoRoot();
  let config;
  try {
    config = loadConfig(root);
    initContainer({ entryCommand: `workflow ${argv.join(" ")}` });
  } catch (err) {
    Envelope.fail("workflow", subcommand, "NO_CONFIG", err.message).output();
    process.exit(EXIT_ERROR);
  }

  // Build ctx
  const ctx = {
    root,
    config,
    boardConfig: null,
    boardConfigError: null,
    args: rest,
  };

  // Load boardConfig (calls gh CLI). Commands declare their board needs:
  //   - requiresBoard === false: skip the load entirely (board-less commands).
  //   - boardOptional === true: a load failure is non-fatal; the command
  //     receives ctx.boardConfig = null and decides how to degrade.
  //   - default (neither set): a load failure is fatal (NO_BOARD), preserving
  //     existing subcommand behavior.
  if (entry.requiresBoard !== false) {
    try {
      ctx.boardConfig = loadBoardConfig();
    } catch (err) {
      if (entry.boardOptional) {
        ctx.boardConfigError = err;
      } else {
        Envelope.fail("workflow", subcommand, "NO_BOARD", err.message).output();
        process.exit(EXIT_ERROR);
      }
    }
  }

  parseEntryArgs(entry, rest, ctx);

  try {
    const mod = await entry.command();
    const Command = mod.default;
    const instance = new Command();
    const result = await instance.run(ctx);
    Envelope.ok("workflow", subcommand, result || {}).output();
  } catch (err) {
    Envelope.fail("workflow", subcommand, err.code || "ERROR", err.message).output();
  }
}

await dispatch();
