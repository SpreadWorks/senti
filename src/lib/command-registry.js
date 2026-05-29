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
 *     help?: string,
 *     args?: { flags?, options?, positional? },
 *     command: () => Promise<{ default: typeof Command }>,
 *     outputMode: "envelope" | "raw",
 *     passthroughArgs?: boolean,
 *     pre?, post?, onError?,
 *   }
 */

import { FLOW_COMMANDS } from "../flow/registry.js";

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
// Unified root
// ---------------------------------------------------------------------------

export const allCommands = {
  flow: flowCommands,
  docs: docsCommands,
  check: checkCommands,
  metrics: metricsCommands,
  spec: specCommands,
};
