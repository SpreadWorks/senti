/**
 * tests/helpers/test-runner-search-dirs.js
 *
 * Spec 212: pure helpers used by tests/run.js to build the set of search
 * directories and validate flag combinations.
 *
 * Selector resolution order (highest first):
 *   --agent : [tests/agent] only
 *   --all   : default dirs + [tests/agent]
 *   --preset: [tests/unit, tests/e2e, src/presets/<resolved>/tests]
 *   --scope : [tests/<scope>, ...src/presets/*\/tests/<scope>]
 *   none    : default dirs ([tests/unit, tests/e2e, src/presets])
 *
 * The tests/agent directory is included only via --agent or --all.
 */

import { join } from "node:path";

export function buildSearchDirs({ root, presetsSubdir = "src/presets" }, opts = {}) {
  const {
    preset,
    scope,
    agent,
    all,
    presetDirName,
    realPresetNames = [],
  } = opts;
  const PRESETS_DIR = join(root, presetsSubdir);
  const AGENT_DIR = join(root, "tests", "agent");

  if (agent) return [AGENT_DIR];

  const defaults = () => [
    join(root, "tests", "unit"),
    join(root, "tests", "e2e"),
    PRESETS_DIR,
  ];

  if (all) return [...defaults(), AGENT_DIR];

  if (preset) {
    const name = presetDirName || preset;
    return [
      join(root, "tests", "unit"),
      join(root, "tests", "e2e"),
      join(PRESETS_DIR, name, "tests"),
    ];
  }

  if (scope) {
    return [
      join(root, "tests", scope),
      ...realPresetNames.map((name) => join(PRESETS_DIR, name, "tests", scope)),
    ];
  }

  return defaults();
}

export function validateFlags(opts = {}) {
  const { agent, all, preset, scope } = opts;
  if (agent && (all || preset || scope)) {
    return {
      error:
        "--agent cannot be combined with --all / --preset / --scope (exclusive selector)",
    };
  }
  return { error: null };
}
