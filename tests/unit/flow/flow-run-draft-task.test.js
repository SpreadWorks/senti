/**
 * tests/unit/flow/flow-run-draft-task.test.js
 *
 * Tests for `flow run draft-task` CLI (REQ-P3-1..5).
 * Spec: 198-test-first-determinism-core.
 *
 * Strategy: inject a stub AI agent via env (SDD_FORGE_AGENT_STUB=<path>) so
 * tests can script gate PASS / FAIL without spawning a real provider.
 * Retry count is capped by config.flow.retry.max.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "fs";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow } from "../../helpers/flow-setup.js";
import { PASS_DRAFT_ESCAPED } from "./fixtures/drafts.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

function writeStubAgent(tmp, script) {
  const p = join(tmp, "stub-agent.mjs");
  fs.writeFileSync(p, script);
  return p;
}

const PASS_DRAFT = PASS_DRAFT_ESCAPED;

function makeFlowWithAdditionTask(tmp, overrides = {}) {
  return setupFlow(tmp, {
    spec: "specs/198-test-first-determinism-core/spec.md",
    currentTaskId: "T-add",
    tasks: [{
      id: "T-add",
      title: "addition task",
      origin: "addition",
      status: "in_progress",
      steps: [
        { id: "draft", status: "in_progress" },
        { id: "approval", status: "pending" },
        { id: "gate", status: "pending" },
        { id: "approval-2", status: "pending" },
        { id: "write-tests", status: "pending" },
        { id: "impl", status: "pending" },
        { id: "run-tests", status: "pending" },
        { id: "review", status: "pending" },
        { id: "update-overview", status: "pending" },
      ],
      requirements: [],
    }],
    ...overrides,
  });
}

describe("flow run draft-task CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("REQ-P3-1: generates draft via tool-driven agent call and writes it under the task", () => {
    tmp = createTmpDir();
    makeFlowWithAdditionTask(tmp);
    const stub = writeStubAgent(tmp,
      `process.stdout.write(JSON.stringify({ draft: "${PASS_DRAFT}" }));`);
    const out = execFileSync(
      "node", [FLOW_CMD, "run", "draft-task", "--task-id", "T-add"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_AGENT_STUB: stub }, cwd: tmp },
    );
    const env = JSON.parse(out);
    assert.equal(env.ok, true);
    assert.equal(env.type, "run");
    assert.equal(env.key, "draft-task");
    assert.ok(env.data?.draftPath, "draftPath must be returned");
  });

  it("REQ-P3-2: gate PASS is the trust point (no AI self-approval)", () => {
    tmp = createTmpDir();
    makeFlowWithAdditionTask(tmp);
    const stub = writeStubAgent(tmp,
      `process.stdout.write(JSON.stringify({ draft: "${PASS_DRAFT}", selfApproved: true }));`);
    const out = execFileSync(
      "node", [FLOW_CMD, "run", "draft-task", "--task-id", "T-add"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_AGENT_STUB: stub }, cwd: tmp },
    );
    const env = JSON.parse(out);
    // Approval decision must come from gate result, not from AI output fields.
    assert.ok(env.data?.gate, "gate result must be present in envelope");
    assert.notEqual(env.data?.approvedBy, "ai", "AI self-approval must not be honored");
  });

  it("REQ-P3-3: retries up to configured limit when gate FAILs, then escalates", () => {
    tmp = createTmpDir();
    makeFlowWithAdditionTask(tmp);
    fs.writeFileSync(join(tmp, ".sdd-forge/config.json"), JSON.stringify({
      lang: "ja", type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      flow: { retry: { max: 2 } },
    }));
    // Stub produces deliberately bad draft every invocation so gate will FAIL.
    const stub = writeStubAgent(tmp,
      `process.stdout.write(JSON.stringify({ draft: "" }));`);
    try {
      execFileSync(
        "node", [FLOW_CMD, "run", "draft-task", "--task-id", "T-add"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_AGENT_STUB: stub }, cwd: tmp },
      );
      assert.fail("should escalate after retry exhaustion");
    } catch (err) {
      const env = JSON.parse(err.stdout || err.stderr);
      assert.equal(env.ok, false);
      assert.match(env.errors?.[0]?.code || "", /ESCALATE|RETRY/);
      assert.ok((env.data?.attempts ?? 0) <= 2 + 1, "attempts bounded by retry.max");
    }
  });

  it("REQ-P3-4: autoApprove=true + gate PASS proceeds automatically", () => {
    tmp = createTmpDir();
    makeFlowWithAdditionTask(tmp);
    // Patch flow.json wherever flow-manager stored it to enable autoApprove.
    for (const p of walk(tmp)) {
      if (p.endsWith("flow.json")) {
        const j = JSON.parse(fs.readFileSync(p, "utf8"));
        j.autoApprove = true;
        fs.writeFileSync(p, JSON.stringify(j));
      }
    }
    const stub = writeStubAgent(tmp,
      `process.stdout.write(JSON.stringify({ draft: "${PASS_DRAFT}" }));`);
    const out = execFileSync(
      "node", [FLOW_CMD, "run", "draft-task", "--task-id", "T-add"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_AGENT_STUB: stub }, cwd: tmp },
    );
    const env = JSON.parse(out);
    assert.equal(env.ok, true);
    assert.equal(env.data?.autoApproved, true);
  });
});

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}
