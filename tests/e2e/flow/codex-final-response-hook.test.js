import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";

const HOOK = path.resolve("src/codex-hooks/senti-flow-final-response-guard.mjs");

function installFakeSenti(root, guardResponse) {
  const bin = path.join(root, "fake-senti.mjs");
  const log = path.join(root, "senti-calls.jsonl");
  writeFile(root, "fake-senti.mjs", `#!/usr/bin/env node
import fs from "node:fs";
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_SENTI_LOG, JSON.stringify(args) + "\\n");
if (args.join(" ") === "flow get status") {
  console.log(JSON.stringify({ active: true, runId: "run-481", spec: "specs/481-flow/spec.json", issue: 481 }));
} else {
  console.log(JSON.stringify(${JSON.stringify(guardResponse)}));
}
`);
  fs.chmodSync(bin, 0o755);
  return { bin, log };
}

function invokeHook(root, fakeSenti) {
  return spawnSync(process.execPath, [HOOK], {
    cwd: root,
    input: JSON.stringify({ cwd: root, hook_event_name: "Stop" }),
    encoding: "utf8",
    env: {
      ...process.env,
      SENTI_BIN: fakeSenti.bin,
      FAKE_SENTI_LOG: fakeSenti.log,
    },
  });
}

function readCalls(log) {
  return fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);
}

describe("Codex Stop hook Flow final-response enforcement", () => {
  let root;
  afterEach(() => root && removeTmpDir(root));

  it("replaces a repair_evidence final attempt with a target-guarded continuation", () => {
    root = createTmpDir("senti-codex-stop-hook-");
    const fakeSenti = installFakeSenti(root, {
      ok: false,
      data: {
        finalResponse: {
          allowed: false,
          directive: { kind: "repair_evidence", actionId: "REPAIR_TEST_REVIEW" },
        },
      },
      errors: [{ code: "FLOW_CONTINUATION_REQUIRED" }],
    });

    const result = invokeHook(root, fakeSenti);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.decision, "block");
    assert.match(output.reason, /repair_evidence/);
    assert.deepEqual(readCalls(fakeSenti.log), [
      ["flow", "get", "status"],
      [
        "flow", "get", "final-response-guard",
        "--expect-run-id", "run-481",
        "--expect-spec", "specs/481-flow/spec.json",
        "--expect-issue", "481",
      ],
    ]);
  });

  for (const reason of ["await_user_decision", "blocked", "completed"]) {
    it(`permits a ${reason} final response`, () => {
      root = createTmpDir(`senti-codex-stop-${reason}-`);
      const fakeSenti = installFakeSenti(root, {
        ok: true,
        data: { finalResponse: { allowed: true, reason } },
        errors: [],
      });

      const result = invokeHook(root, fakeSenti);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), {});
    });
  }
});
