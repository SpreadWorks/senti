/**
 * tests/unit/flow/run-retro-no-missing-requirements.test.js
 *
 * spec 219 R2: spec.json に requirements があり、diff も存在する状態で retro を
 * 実行したとき、`no requirements found` 系エラーで落ちないこと (dry-run で検証)。
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { RunRetroCommand } from "../../../src/flow/lib/run-retro.js";

function createRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "retro-req-"));
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "config", "user.email", "t@t.t"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "config", "user.name", "t"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "checkout", "-b", "main"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "checkout", "-b", "feature/001-test"], { stdio: "ignore" });
  fs.writeFileSync(path.join(tmp, "change.txt"), "hello\n");
  execFileSync("git", ["-C", tmp, "add", "."], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "-m", "change"], { stdio: "ignore" });
  return tmp;
}

function writeSpec(tmp, specId, requirements) {
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    goal: "test",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements,
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  }, null, 2));
  fs.writeFileSync(path.join(specDir, "spec.md"), "# Spec\n");
  return specDir;
}

describe("spec 219 R2: retro does not fail when spec.json.requirements is populated", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("dry-run retro succeeds with requirements in spec.json and diff present", async () => {
    tmp = createRepo();
    const specId = "001-test";
    writeSpec(tmp, specId, [
      { id: "R1", desc: "first", priority: "must", status: "pending" },
    ]);

    const ctx = {
      root: tmp,
      dryRun: true,
      flowState: {
        spec: `specs/${specId}/spec.md`,
        baseBranch: "main",
        requirements: [],
      },
    };

    const cmd = new RunRetroCommand();
    const out = await cmd.execute(ctx);
    assert.equal(out.result, "dry-run");
    assert.equal(out.artifacts.requirementsCount, 1);
  });

  it("throws a clear error referring to spec.json (not flow.json) when requirements are absent", async () => {
    tmp = createRepo();
    const specId = "001-test";
    writeSpec(tmp, specId, []);

    const ctx = {
      root: tmp,
      dryRun: true,
      flowState: {
        spec: `specs/${specId}/spec.md`,
        baseBranch: "main",
        requirements: [],
      },
    };

    const cmd = new RunRetroCommand();
    await assert.rejects(
      cmd.execute(ctx),
      (err) => {
        assert.doesNotMatch(
          err.message,
          /flow\.json/,
          "error must point at spec.json as the source of truth",
        );
        assert.match(err.message, /spec\.json|requirements/i);
        return true;
      },
    );
  });
});
