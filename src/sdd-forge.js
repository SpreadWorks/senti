#!/usr/bin/env node
/**
 * src/sdd-forge.js
 *
 * sdd-forge CLI entry point.
 * Routes top-level subcommands to dedicated dispatchers:
 *   docs    → src/docs.js
 *   flow    → src/flow.js
 *   check   → src/check.js
 *   metrics → src/metrics.js
 *   spec    → src/spec.js
 *   hook    → src/hook.js
 *   workflow → src/workflow/index.js  ([EXPERIMENTAL])
 *   setup   → src/setup.js
 *   upgrade → src/upgrade.js
 *   help    → src/help.js
 */

import path from "path";
import { pathToFileURL } from "node:url";
import { PKG_DIR } from "./lib/cli.js";
import { EXIT_ERROR } from "./lib/constants.js";
import { initContainer } from "./lib/container.js";

const rawArgs = process.argv.slice(2);
const [subCmd, ...rest] = rawArgs;
let agentWorkDirOverride = null;
const enableFinalizeCleanupDurablePaths = subCmd === "flow" && rest[0] === "run" && rest[1] === "finalize-cleanup";
if (subCmd === "flow" && rest[0] === "run") {
  for (let i = 2; i < rest.length; i += 1) {
    if (rest[i] === "--agent-work-dir") {
      const value = rest[i + 1];
      const normalized = value == null ? "" : String(value).trim();
      if (normalized !== "" && !normalized.startsWith("-")) agentWorkDirOverride = normalized;
      break;
    }
  }
}

// version (-v / --version / -V)
if (subCmd === "-v" || subCmd === "--version" || subCmd === "-V") {
  const { getPackageVersion } = await import("./lib/cli.js");
  console.log(getPackageVersion());
  process.exit(0);
}

// help (no args / -h / --help / help [topic])
if (!subCmd || subCmd === "-h" || subCmd === "--help" || subCmd === "help") {
  initContainer({ entryCommand: rawArgs.join(" ") });
  const helpPath = path.join(PKG_DIR, "help.js");
  process.argv = [process.argv[0], helpPath, ...rest];
  const helpMod = await import(pathToFileURL(helpPath).href);
  if (typeof helpMod.main === "function") helpMod.main();
  process.exit(0);
}

// Initialize the shared dependency container once; dispatchers and commands
// below import `container` directly from ./lib/container.js.
initContainer({
  entryCommand: rawArgs.join(" "),
  agentWorkDirOverride,
  finalizeCleanupDurablePaths: enableFinalizeCleanupDurablePaths,
});

/** Namespace dispatchers — receive subcommand + rest args */
const NAMESPACE_SCRIPTS = {
  docs: "docs",
  flow: "flow",
  check: "check",
  metrics: "metrics",
  spec: "spec",
  hook: "hook",
  workflow: "workflow/index",
};

/** Independent commands — receive rest args directly */
const INDEPENDENT = {
  setup:   "setup",
  upgrade: "upgrade",
  presets: "presets-cmd",
};

if (NAMESPACE_SCRIPTS[subCmd]) {
  const dispatcherPath = path.join(PKG_DIR, `${NAMESPACE_SCRIPTS[subCmd]}.js`);
  process.argv = [process.argv[0], dispatcherPath, ...rest];
  await import(pathToFileURL(dispatcherPath).href);
} else if (INDEPENDENT[subCmd]) {
  const scriptPath = path.join(PKG_DIR, `${INDEPENDENT[subCmd]}.js`);
  process.argv = [process.argv[0], scriptPath, ...rest];
  const mod = await import(pathToFileURL(scriptPath).href);
  if (typeof mod.main !== "function") {
    console.error(`sdd-forge: command module does not export main(): ${scriptPath}`);
    process.exit(EXIT_ERROR);
  }
  try {
    await mod.main();
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(EXIT_ERROR);
  }
} else {
  console.error(`sdd-forge: unknown command '${subCmd}'`);
  console.error("Run: sdd-forge help");
  process.exit(EXIT_ERROR);
}
