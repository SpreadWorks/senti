#!/usr/bin/env node
/**
 * src/flow.js
 *
 * Flow dispatcher. Top-level command routing (prepare / resume / get / set /
 * run) feeds the shared dispatcher (src/lib/dispatcher.js), which handles
 * argument parsing, lifecycle hooks, and envelope output uniformly across
 * every domain.
 */

import { EXIT_ERROR } from "./lib/constants.js";
import { container, initContainer } from "./lib/container.js";
import { resolveFlowContext } from "./flow/lib/flow-context.js";
import { flowCommands } from "./lib/command-registry.js";
import { dispatch } from "./lib/dispatcher.js";

initContainer();

const args = process.argv.slice(2);
const group = args[0];
const rest = args.slice(1);

if (!group || group === "-h" || group === "--help") {
  const lines = [
    "Usage: sdd-forge flow <command> [options]",
    "",
    "Commands:",
    `  ${"prepare".padEnd(18)} Initialize spec and branch/worktree`,
    `  ${"resume".padEnd(18)} Discover and resume active flow`,
    `  ${"get <key>".padEnd(18)} Read flow state`,
    `  ${"set <key>".padEnd(18)} Update flow state`,
    `  ${"run <action>".padEnd(18)} Execute flow actions`,
  ];
  console.log(lines.join("\n"));
  if (!group) process.exit(EXIT_ERROR);
  process.exit(0);
}

async function run(entry, argv, envelopeType, envelopeKey, helpPathOverride) {
  const resolvedEntry = entry?.helpPath
    ? entry
    : { ...entry, helpPath: helpPathOverride || `sdd-forge flow ${envelopeType} ${envelopeKey} --help` };
  await dispatch({
    container,
    entry: resolvedEntry,
    argv,
    envelopeType,
    envelopeKey,
    buildHookCtx: (c) => resolveFlowContext(c),
  });
}

async function dispatchFlow() {
  // Top-level: resume
  if (group === "resume") {
    await run(flowCommands.resume, rest, "run", "resume");
    return;
  }

  // Top-level: prepare
  if (group === "prepare") {
    await run(flowCommands.prepare, rest, "run", "prepare-spec");
    return;
  }

  // Group commands: get / set / run
  const commands = flowCommands[group];
  if (!commands || typeof commands !== "object" || typeof commands.command === "function") {
    console.error(`sdd-forge flow: unknown command '${group}'`);
    console.error("Run: sdd-forge flow --help");
    process.exit(EXIT_ERROR);
  }

  const cmd = rest[0];
  const cmdArgs = rest.slice(1);

  if (!cmd || cmd === "-h" || cmd === "--help") {
    const lines = [`Usage: sdd-forge flow ${group} <key> [options]`, "", "Keys:"];
    for (const name of Object.keys(commands)) lines.push(`  ${name}`);
    console.log(lines.join("\n"));
    if (!cmd) process.exit(EXIT_ERROR);
    process.exit(0);
  }

  const entry = commands[cmd];
  if (!entry) {
    console.error(`sdd-forge flow ${group}: unknown key '${cmd}'`);
    console.error(`Run: sdd-forge flow ${group} --help`);
    process.exit(EXIT_ERROR);
  }

  await run(entry, cmdArgs, group, cmd);
}

await dispatchFlow();
