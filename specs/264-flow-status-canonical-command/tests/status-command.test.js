// spec: R2 R3
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");
const SDD_FORGE = resolve(ROOT, "src/sdd-forge.js");

function runFlow(args) {
  return spawnSync(process.execPath, [SDD_FORGE, "flow", ...args], {
    cwd: ROOT,
    encoding: "utf8",
  });
}

describe("flow status canonical command guidance", () => {
  it("R2: keeps flow get status as the canonical status command", () => {
    const res = runFlow(["get", "status"]);
    assert.equal(res.status, 0, res.stderr || res.stdout);

    const envelope = JSON.parse(res.stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "get");
    assert.equal(envelope.key, "status");
  });

  it("R3: rejects flow status and points to flow get status", () => {
    const res = runFlow(["status"]);
    assert.notEqual(res.status, 0, "flow status must not be accepted as an alias");
    assert.match(res.stderr, /unknown command 'status'/);
    assert.match(res.stderr, /sdd-forge flow get status/);
  });
});
