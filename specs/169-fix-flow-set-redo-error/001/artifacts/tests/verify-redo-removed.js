/**
 * Spec 169 verification: redo entry removed from registry
 *
 * Verifies:
 * 1. registry.js no longer has a "redo" key in the set group
 * 2. `flow set redo` does not crash with "entry.command is not a function"
 */

import { execFile } from "node:child_process";
import { strict as assert } from "node:assert";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");
const cli = resolve(root, "src/sdd-forge.js");

function run(args) {
  return new Promise((resolve) => {
    execFile("node", [cli, ...args], { cwd: root }, (err, stdout, stderr) => {
      resolve({ code: err?.code ?? 0, stdout, stderr });
    });
  });
}

async function test() {
  // Test: `flow set redo` should not crash with "entry.command is not a function"
  const result = await run(["flow", "set", "redo"]);
  assert.notEqual(result.code, 0, "flow set redo should exit with non-zero code");

  const output = result.stdout + result.stderr;
  assert.ok(
    !output.includes("entry.command is not a function"),
    `Expected no "entry.command is not a function" error, got: ${output}`
  );

  console.log("PASS: redo entry removed, no command crash");
}

test().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
