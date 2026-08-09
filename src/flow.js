#!/usr/bin/env node
/**
 * src/flow.js
 *
 * Flow dispatcher. Top-level command routing (prepare / park / resume / get /
 * set / run) feeds the shared dispatcher (src/lib/dispatcher.js), which handles
 * argument parsing, lifecycle hooks, and envelope output uniformly across
 * every domain.
 */

import { EXIT_ERROR } from "./lib/constants.js";
import { container, initContainer } from "./lib/container.js";
import { resolveFlowContext } from "./flow/lib/flow-context.js";
import { coreCommandRegistry } from "./lib/command-registry.js";
import { dispatch } from "./lib/dispatcher.js";

initContainer();

const args = process.argv.slice(2);
const group = args[0];
const rest = args.slice(1);
const flowDefinition = coreCommandRegistry.find(["flow"]);
const flowCommandSuggestionByGroup = {
  status: "senrail flow get status",
};

if (!group || group === "-h" || group === "--help") {
  console.log(flowDefinition.renderHelp());
  if (!group) process.exit(EXIT_ERROR);
  process.exit(0);
}

async function run(entry, argv, envelopeType, envelopeKey, helpPathOverride) {
  const resolvedEntry = entry?.helpPath
    ? entry
    : { ...entry, helpPath: helpPathOverride || `senrail flow ${envelopeType} ${envelopeKey} --help` };
  const directParkedInvocation = resolvedEntry.directParkedAuthority === true
    || (resolvedEntry.directParkedAuthority === "when-parked" && argv.includes("--parked"));
  const runtimeLog = !directParkedInvocation
    && !(group === "get" && envelopeKey === "runtime-log");
  await dispatch({
    container,
    entry: resolvedEntry,
    argv,
    envelopeType,
    envelopeKey,
    runtimeLog,
    buildHookCtx: (c, input = {}) => {
      if (directParkedInvocation) {
        return {
          root: c.get("paths").root,
          mainRoot: c.get("mainRoot"),
          config: c.get("config"),
          flowManager: c.get("flowManager"),
          flowState: null,
          preparingFlowState: null,
          specId: null,
          inWorktree: c.get("inWorktree"),
          authorityRoot: c.get("paths").root,
          flowResolutionError: null,
          worktreeFlowProvenance: null,
        };
      }
      return resolveFlowContext(c, {
        allowMissingActive: resolvedEntry.requiresFlow === false,
        captureTargetResolutionError: resolvedEntry.explicitTargetResolution === true
          || resolvedEntry.targetNotFoundAsMismatch === true,
        explicitTargetResolution: resolvedEntry.explicitTargetResolution === true,
        mismatchTargetResolution: resolvedEntry.mismatchTargetResolution === true,
        positionalRunIdTarget: resolvedEntry.positionalRunIdTarget === true,
        preparingRunIdSelection: resolvedEntry.preparingRunIdSelection !== false,
        input,
      });
    },
  });
}

async function dispatchFlow() {
  // Top-level: park
  if (group === "park") {
    await run(flowDefinition.find(["park"]), rest, "run", "park");
    return;
  }

  // Top-level: resume
  if (group === "resume") {
    await run(flowDefinition.find(["resume"]), rest, "run", "resume");
    return;
  }

  // Top-level: prepare
  if (group === "prepare") {
    await run(flowDefinition.find(["prepare"]), rest, "run", "prepare-spec");
    return;
  }

  // Group commands: get / set / run
  const commands = flowDefinition.find([group]);
  if (!commands || commands.command || commands.subcommands.size === 0) {
    console.error(`senrail flow: unknown command '${group}'`);
    const suggestion = flowCommandSuggestionByGroup[group];
    if (suggestion) {
      console.error(`Did you mean: ${suggestion}`);
    }
    console.error("Run: senrail flow --help");
    process.exit(EXIT_ERROR);
  }

  const cmd = rest[0];
  const cmdArgs = rest.slice(1);

  if (!cmd || cmd === "-h" || cmd === "--help") {
    console.log(commands.renderHelp());
    if (!cmd) process.exit(EXIT_ERROR);
    process.exit(0);
  }

  const entry = commands.find([cmd]);
  if (!entry?.command) {
    console.error(`senrail flow ${group}: unknown key '${cmd}'`);
    console.error(`Run: senrail flow ${group} --help`);
    process.exit(EXIT_ERROR);
  }

  await run(entry, cmdArgs, group, cmd);
}

await dispatchFlow();
