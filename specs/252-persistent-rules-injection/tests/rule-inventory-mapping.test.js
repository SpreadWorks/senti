// spec: R32 R34
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

test("R32: spec.md contains a migration mapping section with all 10 rule ids", () => {
  const specMd = fs.readFileSync(path.join(here, "..", "spec.md"), "utf8");
  const ids = [
    "no-premature-conclusion",
    "no-auto-mode-override-skill",
    "thoroughness",
    "no-shortcuts",
    "wait-for-instruction-skill",
    "commit-split-strategy",
    "no-scope-splitting",
    "choice-format-discipline",
    "no-chain-sddforge",
    "no-shared-repo-git-ops",
  ];
  for (const id of ids) {
    assert.match(specMd, new RegExp(id), `spec.md must reference rule id ${id}`);
  }
});

test("R34: out-of-scope rule-like prose remains unmigrated in non-listed partials", () => {
  const oosPartials = [
    "src/templates/partials/flow-tracking.md",
    "src/templates/partials/context-recording.md",
    "src/templates/partials/issue-log-recording.md",
  ];
  for (const rel of oosPartials) {
    const file = path.join(repoRoot, rel);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    assert.ok(
      !/\{\{data\("base\.skills\.rule"/.test(content),
      `${rel} must NOT contain a migrated skill-rule directive (out-of-scope partial)`,
    );
  }
});
