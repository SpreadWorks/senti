/**
 * Spec 199 verification test (spec-scoped, not run by default npm test).
 *
 * REQ-P3: flow-impl SKILL.md's Required Sequence must include an
 * addition-task detection step that invokes `sdd-forge flow run draft-task
 * --task-id <id>`.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const SKILL_PATH = path.join(
  REPO_ROOT,
  "src/templates/skills/sdd-forge.flow-impl/SKILL.md",
);

describe("spec 199: flow-impl SKILL.md addition-task step", () => {
  it("Required Sequence contains a procedural step invoking `sdd-forge flow run draft-task`", () => {
    const md = fs.readFileSync(SKILL_PATH, "utf8");
    const reqSeqIdx = md.indexOf("## Required Sequence");
    assert.ok(reqSeqIdx >= 0, "Required Sequence section must exist");
    const requiredSequence = md.slice(reqSeqIdx);

    assert.ok(
      /sdd-forge flow run draft-task --task-id/.test(requiredSequence),
      "Required Sequence must contain the `sdd-forge flow run draft-task --task-id` invocation",
    );
    assert.ok(
      /addition task/i.test(requiredSequence),
      "Required Sequence must reference addition task detection",
    );
  });
});
