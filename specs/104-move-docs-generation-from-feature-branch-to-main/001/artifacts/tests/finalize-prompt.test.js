import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow } from "../../../tests/helpers/flow-setup.js";

const CMD = join(process.cwd(), "src/flow.js");

describe("finalize prompt updates", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("finalize.steps prompt has sync before cleanup", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const result = execFileSync("node", [CMD, "get", "prompt", "finalize.steps"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    const data = JSON.parse(result);
    assert.ok(data.ok);
    const choices = data.data.choices;

    // Find sync and cleanup choices
    const syncChoice = choices.find(c => /sync|ドキュメント/i.test(c.label));
    const cleanupChoice = choices.find(c => /cleanup|ブランチ|削除/i.test(c.label));

    assert.ok(syncChoice, "sync choice should exist");
    assert.ok(cleanupChoice, "cleanup choice should exist");
    assert.ok(syncChoice.id < cleanupChoice.id, "sync step number should be less than cleanup step number");
  });

  it("finalize.merge-strategy prompt has no duplicate merge/squash", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const result = execFileSync("node", [CMD, "get", "prompt", "finalize.merge-strategy"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    const data = JSON.parse(result);
    assert.ok(data.ok);
    const choices = data.data.choices;

    // Should not have both "merge" and "squash merge" — only squash merge
    const mergeOnly = choices.filter(c => c.label === "merge");
    assert.equal(mergeOnly.length, 0, "plain 'merge' choice should be removed");

    const squash = choices.find(c => /squash/i.test(c.label));
    assert.ok(squash, "squash merge choice should exist");

    const pr = choices.find(c => /pull request|pr/i.test(c.label));
    assert.ok(pr, "pull request choice should exist");
  });
});
