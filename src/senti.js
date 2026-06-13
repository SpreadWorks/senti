#!/usr/bin/env node
/**
 * src/senti.js
 *
 * senti CLI entry point.
 * Routes top-level subcommands to dedicated dispatchers:
 *   docs    → src/docs.js
 *   flow    → src/flow.js
 *   check   → src/check.js
 *   metrics → src/metrics.js
 *   spec    → src/spec.js
 *   hook    → src/hook.js
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
  initContainer({ entryCommand: rawArgs.join(" "), allowInvalidConfig: true });
  const helpPath = path.join(PKG_DIR, "help.js");
  process.argv = [process.argv[0], helpPath, ...rest];
  const helpMod = await import(pathToFileURL(helpPath).href);
  if (typeof helpMod.main === "function") await helpMod.main();
  process.exit(0);
}

/** Namespace dispatchers — receive subcommand + rest args */
const NAMESPACE_SCRIPTS = {
  docs: "docs",
  flow: "flow",
  check: "check",
  metrics: "metrics",
  spec: "spec",
  hook: "hook",
};

/** Independent commands — receive rest args directly */
const INDEPENDENT = {
  setup:   "setup",
  upgrade: "upgrade",
  presets: "presets-cmd",
  plugin:  "plugin",
};

function isHelpRequest(args) {
  return args.includes("-h") || args.includes("--help");
}

function helpTopic(head, args) {
  return [head, ...args.filter((arg) => arg !== "-h" && arg !== "--help")];
}

async function hasCoreHelpMetadata(topic) {
  const { coreCommandMetadataRegistry } = await import("./lib/command-registry.js");
  return Boolean(coreCommandMetadataRegistry.findCommand(topic));
}

async function renderSharedHelp(argv) {
  initContainer({ entryCommand: rawArgs.join(" "), allowInvalidConfig: true });
  const { renderHelp } = await import("./help.js");
  console.log(await renderHelp({ root: process.cwd(), argv }));
  process.exit(0);
}

const sharedHelpTopic = helpTopic(subCmd, rest);
if (NAMESPACE_SCRIPTS[subCmd] && isHelpRequest(rest) && await hasCoreHelpMetadata(sharedHelpTopic)) {
  await renderSharedHelp([subCmd, ...rest]);
}

if (INDEPENDENT[subCmd] && isHelpRequest(rest)) {
  await renderSharedHelp([subCmd, ...rest]);
}

// Initialize the shared dependency container once; dispatchers and commands
// below import `container` directly from ./lib/container.js.
const CORE_ENTRY_COMMANDS = new Set(["docs", "flow", "check", "metrics", "spec", "hook", "setup", "upgrade", "presets", "plugin"]);
initContainer({
  entryCommand: rawArgs.join(" "),
  agentWorkDirOverride,
  finalizeCleanupDurablePaths: enableFinalizeCleanupDurablePaths,
  allowInvalidConfig: subCmd === "upgrade" || !CORE_ENTRY_COMMANDS.has(subCmd),
});

if (NAMESPACE_SCRIPTS[subCmd]) {
  const dispatcherPath = path.join(PKG_DIR, `${NAMESPACE_SCRIPTS[subCmd]}.js`);
  process.argv = [process.argv[0], dispatcherPath, ...rest];
  await import(pathToFileURL(dispatcherPath).href);
} else if (INDEPENDENT[subCmd]) {
  const scriptPath = path.join(PKG_DIR, `${INDEPENDENT[subCmd]}.js`);
  process.argv = [process.argv[0], scriptPath, ...rest];
  const mod = await import(pathToFileURL(scriptPath).href);
  if (typeof mod.main !== "function") {
    console.error(`senti: command module does not export main(): ${scriptPath}`);
    process.exit(EXIT_ERROR);
  }
  try {
    await mod.main();
  } catch (err) {
    console.error(err?.stack || String(err));
    process.exit(EXIT_ERROR);
  }
} else {
  try {
    const { repoRoot } = await import("./lib/cli.js");
    const { dispatchPluginCommand } = await import("./lib/plugin-registry.js");
    if (isHelpRequest(rest)) {
      await renderSharedHelp([subCmd, ...rest]);
    }
    const handled = await dispatchPluginCommand(repoRoot(), subCmd, rest);
    if (handled) {
      if (handled.ok != null) {
        if (handled.ok && handled.key === "help" && typeof handled.data?.help === "string") {
          console.log(handled.data.help);
          process.exit(0);
        }
        console.log(JSON.stringify(handled, null, 2));
        process.exit(handled.ok ? 0 : (handled.exitCode || EXIT_ERROR));
      }
      process.exit(0);
    }
    console.error(`senti: unknown command '${subCmd}' is unavailable. Enable a plugin that contributes this command, or run: senti plugin list`);
  } catch (err) {
    console.error(`senti: unknown command '${subCmd}' is unavailable. Plugin command resolution failed: ${err.message}`);
  }
  console.error("Run: senti help");
  process.exit(EXIT_ERROR);
}
