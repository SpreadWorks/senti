/**
 * src/flow/lib/run-tests.js
 *
 * FlowCommand: `flow run tests` — execute the project's test suite in a
 * subprocess, capture its output to a log file under the work dir, and
 * record exit code + per-type counts to flow.json `test.summary`.
 *
 * Scope:
 *   - task   → state.currentTaskId != null (REQ-P1-2)
 *   - parent → otherwise
 *
 * Command resolution order (REQ-P1-3):
 *   1. config.commands.test.{task|parent}
 *   2. package.json scripts inference:
 *        task   → `test:unit` if present, else `test`
 *        parent → `test`
 *
 * Log parser resolution (spec 200 REQ-5):
 *   Delegates to `loadTestParser` which returns a preset-supplied parser when
 *   the active preset ships `src/presets/<type>/test-parser.js`, or the
 *   builtin default otherwise.
 *
 * AI processes observe only the returned envelope; the tool alone writes
 * test.summary into flow.json (REQ-P1-5).
 */

import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { FlowCommand } from "./base-command.js";
import { resolveWorkDir } from "../../lib/config.js";
import { loadTestParser } from "./test-parser-loader.js";

function extractPresetKey(type) {
  const t = Array.isArray(type) ? type[0] : type;
  if (!t) return null;
  const idx = t.lastIndexOf("/");
  return idx >= 0 ? t.slice(idx + 1) : t;
}

const LOG_REL = "logs/test-output.log";

export class RunTestsCommand extends FlowCommand {
  async execute(ctx) {
    const { root, flowState, flowManager, config } = ctx;

    const scope = flowState?.currentTaskId != null ? "task" : "parent";
    const command = resolveTestCommand({ root, config, scope });
    if (!command) {
      const err = new Error(
        "no test command resolvable: neither config.commands.test nor package.json scripts.test is set",
      );
      err.code = "NO_TEST_COMMAND";
      throw err;
    }

    const workDir = resolveWorkDir(root, config);
    const absWork = path.isAbsolute(workDir) ? workDir : path.join(root, workDir);
    const logPath = path.join(absWork, LOG_REL);
    fs.mkdirSync(path.dirname(logPath), { recursive: true });

    const child = spawnSync(command, {
      cwd: root,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const combined = (child.stdout || "") + (child.stderr || "");
    fs.writeFileSync(logPath, combined);

    const exitCode = child.status ?? 1;
    const parser = await loadTestParser({ root, presetKey: extractPresetKey(config?.type) });
    const summary = parser.parseCountsFromLog(combined);
    flowManager.setTestSummary({ ...summary, exitCode });

    const result = {
      scope,
      command,
      exitCode,
      logPath: path.relative(root, logPath),
      summary,
    };
    if (exitCode !== 0) {
      const err = new Error(`tests failed with exit code ${exitCode}`);
      err.code = "TESTS_FAILED";
      err.data = result;
      err.exitCode = exitCode;
      throw err;
    }
    return result;
  }
}

/**
 * Resolve the concrete test command string for the given scope.
 *
 * @param {{ root: string, config: object, scope: "task"|"parent" }} args
 * @returns {string|null}
 */
function resolveTestCommand({ root, config, scope }) {
  const explicit = config?.commands?.test?.[scope];
  if (explicit) return explicit;
  const pkg = readPkgScripts(root);
  if (scope === "task") {
    if (pkg["test:unit"]) return "npm run test:unit";
    if (pkg.test) return "npm test";
    return null;
  }
  return pkg.test ? "npm test" : null;
}

function readPkgScripts(root) {
  const p = path.join(root, "package.json");
  if (!fs.existsSync(p)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return j.scripts || {};
  } catch {
    return {};
  }
}

export default RunTestsCommand;
