// spec: R10 R34
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("req-map.js cleanup (251-ai-test-exec)", () => {
  it("R10: parseTapOutput / extractReqResults / evaluateReqByResults are removed", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/req-map.js"), "utf8");
    assert.ok(!/function\s+parseTapOutput|export\s+function\s+parseTapOutput/.test(src), "parseTapOutput must be removed");
    assert.ok(!/function\s+extractReqResults|export\s+function\s+extractReqResults/.test(src), "extractReqResults must be removed");
    assert.ok(!/function\s+evaluateReqByResults|export\s+function\s+evaluateReqByResults/.test(src), "evaluateReqByResults must be removed");
  });

  it("R34: flow-store.js setTestSummary / parent test summary aggregation remains as legacy", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/lib/flow-store.js"), "utf8");
    assert.ok(/setTestSummary/.test(src), "setTestSummary should remain (legacy compat per R34)");
  });
});
