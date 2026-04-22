import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  computeGitState,
  findPreviousFailState,
  checkNoProgressSinceLastFail,
} from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// spec 210: gate-impl no-op rerun guard
// -----------------------------------------------------------------------------

function initGitRepo() {
  const tmp = createTmpDir();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: tmp });
  execFileSync("git", ["config", "user.email", "t@t"], { cwd: tmp });
  execFileSync("git", ["config", "user.name", "t"], { cwd: tmp });
  fs.writeFileSync(path.join(tmp, "a.txt"), "hello\n");
  execFileSync("git", ["add", "."], { cwd: tmp });
  execFileSync("git", ["commit", "-q", "-m", "init"], { cwd: tmp });
  return tmp;
}

describe("computeGitState (REQ-1 helper)", () => {
  it("returns headSha and worktreeHash as non-empty strings", () => {
    const tmp = initGitRepo();
    try {
      const state = computeGitState(tmp);
      assert.equal(typeof state.headSha, "string");
      assert.equal(typeof state.worktreeHash, "string");
      assert.ok(state.headSha.length > 0);
      assert.ok(state.worktreeHash.length > 0);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("returns the same worktreeHash for identical tree state", () => {
    const tmp = initGitRepo();
    try {
      const a = computeGitState(tmp);
      const b = computeGitState(tmp);
      assert.equal(a.headSha, b.headSha);
      assert.equal(a.worktreeHash, b.worktreeHash);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("returns a different worktreeHash when a tracked file changes", () => {
    const tmp = initGitRepo();
    try {
      const before = computeGitState(tmp);
      fs.writeFileSync(path.join(tmp, "a.txt"), "modified\n");
      const after = computeGitState(tmp);
      assert.equal(before.headSha, after.headSha);
      assert.notEqual(before.worktreeHash, after.worktreeHash);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("returns a different worktreeHash when an untracked file is added", () => {
    const tmp = initGitRepo();
    try {
      const before = computeGitState(tmp);
      fs.writeFileSync(path.join(tmp, "new.txt"), "new\n");
      const after = computeGitState(tmp);
      assert.notEqual(before.worktreeHash, after.worktreeHash);
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("findPreviousFailState (REQ-2, REQ-7, REQ-8)", () => {
  const phase = "task-impl";

  it("returns null when no prior FAIL entry has state identifiers", () => {
    const flowState = { metrics: [{ phase, counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate-impl", phase, reason: "old fail without hash" },
      ],
    };
    assert.equal(findPreviousFailState({ flowState, issueLog, phase }), null);
  });

  it("returns the most recent FAIL state identifiers", () => {
    const flowState = {
      metrics: [
        { phase, counter: "gateRetry", delta: 1 },
        { phase, counter: "gateRetry", delta: 1 },
      ],
    };
    const issueLog = {
      entries: [
        { step: "gate-impl", phase, reason: "fail 1", headSha: "aaa", worktreeHash: "111" },
        { step: "gate-impl", phase, reason: "fail 2", headSha: "bbb", worktreeHash: "222" },
      ],
    };
    const res = findPreviousFailState({ flowState, issueLog, phase });
    assert.deepEqual(res, { headSha: "bbb", worktreeHash: "222" });
  });

  it("ignores entries from other phases", () => {
    const flowState = { metrics: [{ phase, counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate-integration", phase: "integration", reason: "other", headSha: "xxx", worktreeHash: "yyy" },
        { step: "gate-impl", phase, reason: "mine", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    const res = findPreviousFailState({ flowState, issueLog, phase });
    assert.deepEqual(res, { headSha: "aaa", worktreeHash: "111" });
  });

  it("returns null when gateRetry count is 0 (PASS resets the guard)", () => {
    // REQ-8: even if issue-log has a same-phase FAIL with state identifiers,
    // a PASS-driven reset (reset: true) must clear the guard.
    const flowState = {
      metrics: [
        { phase, counter: "gateRetry", delta: 1 },
        { phase, counter: "gateRetry", delta: 0, reset: true },
      ],
    };
    const issueLog = {
      entries: [
        { step: "gate-impl", phase, reason: "fail before pass", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    assert.equal(findPreviousFailState({ flowState, issueLog, phase }), null);
  });
});

describe("checkNoProgressSinceLastFail (REQ-3, REQ-4, REQ-7)", () => {
  const phase = "task-impl";

  it("returns failure envelope with NO_PROGRESS_SINCE_LAST_FAIL when state matches the last FAIL", () => {
    const flowState = { metrics: [{ phase, counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate-impl", phase, reason: "prev fail reason", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    const currentState = { headSha: "aaa", worktreeHash: "111" };
    const result = checkNoProgressSinceLastFail({ flowState, issueLog, phase, currentState });
    assert.ok(result, "expected an envelope return, not null");
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "NO_PROGRESS_SINCE_LAST_FAIL");
    assert.ok(
      result.errors[0].messages.some((m) => /prev fail reason/.test(m)),
      "messages should include the prior FAIL reason",
    );
  });

  it("returns null when either identifier differs", () => {
    const flowState = { metrics: [{ phase, counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate-impl", phase, reason: "prev fail", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    assert.equal(
      checkNoProgressSinceLastFail({
        flowState,
        issueLog,
        phase,
        currentState: { headSha: "aaa", worktreeHash: "222" },
      }),
      null,
    );
    assert.equal(
      checkNoProgressSinceLastFail({
        flowState,
        issueLog,
        phase,
        currentState: { headSha: "bbb", worktreeHash: "111" },
      }),
      null,
    );
  });

  it("returns null when the prior FAIL lacks state identifiers (REQ-7)", () => {
    const flowState = { metrics: [{ phase, counter: "gateRetry", delta: 1 }] };
    const issueLog = {
      entries: [
        { step: "gate-impl", phase, reason: "legacy entry without hash" },
      ],
    };
    assert.equal(
      checkNoProgressSinceLastFail({
        flowState,
        issueLog,
        phase,
        currentState: { headSha: "aaa", worktreeHash: "111" },
      }),
      null,
    );
  });

  it("returns null when no prior FAIL counts toward the retry budget (REQ-8)", () => {
    const flowState = {
      metrics: [
        { phase, counter: "gateRetry", delta: 1 },
        { phase, counter: "gateRetry", delta: 0, reset: true },
      ],
    };
    const issueLog = {
      entries: [
        { step: "gate-impl", phase, reason: "fail before reset", headSha: "aaa", worktreeHash: "111" },
      ],
    };
    assert.equal(
      checkNoProgressSinceLastFail({
        flowState,
        issueLog,
        phase,
        currentState: { headSha: "aaa", worktreeHash: "111" },
      }),
      null,
    );
  });
});

describe("gate-impl prompt MUST items (REQ-5, REQ-6)", () => {
  const readGateImplPrompt = () => fs.readFileSync(
    path.join(process.cwd(), "src/flow/prompts/impl/gate-impl.md"),
    "utf8",
  );

  it("contains MUST about recording fix evidence before re-run (REQ-5)", () => {
    assert.match(
      readGateImplPrompt(),
      /MUST.*(fix[_\s-]?note|what was fixed|修正した|修正証跡|修正内容)/i,
      "gate-impl.md must include a MUST about recording what was fixed before re-run",
    );
  });

  it("contains MUST forbidding re-run without any working-tree change (REQ-6)", () => {
    assert.match(
      readGateImplPrompt(),
      /MUST.*(no\s+change|unchanged|without.*change|無変化|変化が?無い|変更.*無い)/i,
      "gate-impl.md must include a MUST forbidding re-run when the tree has not changed",
    );
  });
});
