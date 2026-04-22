import { writeFileSync, chmodSync } from "fs";
import { join } from "path";

/**
 * Write a small Node.js script that echoes a deterministic JSON response on
 * stdout (ignoring any input), and return the config.agent section that
 * references it via the `echo` command pattern used by existing e2e tests.
 *
 * The stub script writes `jsonResponse` to stdout so the Agent layer parses it
 * as the AI evaluation response (`{ evaluations: [...] }`). Because all flow
 * gate tests that reach the AI path need only a fixed pass response, the
 * script is parameterless — callers choose the response by passing it in.
 */
export function writeStubAgentScript(dir, relPath, jsonResponse) {
  const scriptPath = join(dir, relPath);
  const body = [
    "#!/usr/bin/env node",
    `process.stdout.write(${JSON.stringify(jsonResponse)});`,
    "",
  ].join("\n");
  writeFileSync(scriptPath, body);
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

/**
 * Write a stub agent script that records the prompt (passed via argv) to
 * `capturePath` before emitting `jsonResponse` on stdout. Useful for tests
 * that need to assert the prompt text (e.g. auto-check input source).
 */
export function writeCapturingStubAgentScript(dir, relPath, capturePath, jsonResponse) {
  const scriptPath = join(dir, relPath);
  const body = [
    "#!/usr/bin/env node",
    "const fs = require('fs');",
    `fs.writeFileSync(${JSON.stringify(capturePath)}, process.argv.slice(2).join('\\n'));`,
    `process.stdout.write(${JSON.stringify(jsonResponse)});`,
    "",
  ].join("\n");
  writeFileSync(scriptPath, body);
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

export function stubAgentConfig(scriptPath) {
  return {
    default: "stub-agent",
    providers: {
      "stub-agent": {
        name: "stub-agent",
        command: "node",
        args: [scriptPath],
      },
    },
  };
}

/**
 * Default PASS response for task-impl requirement evaluation — the spec's
 * fallback REQ-SPEC id (used when no **REQ-XXX** markers exist in spec.md).
 */
export function defaultPassResponse() {
  return JSON.stringify({
    evaluations: [
      { guardrail_id: "REQ-SPEC", result: "pass", reason: "stub pass" },
    ],
  });
}
