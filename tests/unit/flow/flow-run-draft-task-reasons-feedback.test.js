/**
 * tests/unit/flow/flow-run-draft-task-reasons-feedback.test.js
 *
 * Spec: 199-draft-task-production-wiring.
 *
 * Verifies that when task-spec gate FAILs on attempt N, the retry loop feeds
 * the FAIL reasons into attempt N+1's draft prompt (REQ-P2).
 *
 * The stub agent receives the current draft prompt via the SDD_FORGE_STUB_PROMPT
 * env var and appends it to a log file. The test inspects the log to assert
 * that attempt 2's prompt contains the dedicated retry feedback section.
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

function writeStubAgent(tmp) {
  const script = `
    import fs from "fs";
    const logPath = process.env.SDD_FORGE_STUB_LOG;
    const counterPath = logPath + ".counter";
    const prompt = process.env.SDD_FORGE_STUB_PROMPT || "";
    let attempt = 0;
    if (fs.existsSync(counterPath)) {
      attempt = Number(fs.readFileSync(counterPath, "utf8"));
    }
    attempt += 1;
    fs.writeFileSync(counterPath, String(attempt));
    fs.appendFileSync(logPath, "----ATTEMPT " + attempt + "----\\n" + prompt + "\\n");
    if (attempt === 1) {
      // Intentionally malformed so task-spec gate FAILs (missing required sections).
      process.stdout.write(JSON.stringify({ draft: "# Draft\\n(no sections)\\n" }));
    } else {
      // Well-formed task-spec-compatible draft that passes checkSpecText.
      process.stdout.write(JSON.stringify({ draft: "${PASS_DRAFT_ESCAPED}" }));
    }
  `;
  const p = join(tmp, "stub-agent-logging.mjs");
  fs.writeFileSync(p, script);
  return p;
}

function makeFlowWithAdditionTask(tmp) {
  return setupFlow(tmp, {
    spec: "specs/199-draft-task-production-wiring/spec.md",
    currentTaskId: "T-add",
    tasks: [{
      id: "T-add",
      title: "addition task for reasons feedback",
      origin: "addition",
      status: "in_progress",
      steps: [
        { id: "draft", status: "in_progress" },
        { id: "approval", status: "pending" },
        { id: "gate", status: "pending" },
      ],
      requirements: [],
    }],
  });
}

describe("REQ-P2: gate FAIL reasons feedback into retry prompt", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("attempt 2 prompt contains the 'Previous attempt failed — reasons' section with attempt 1's FAIL reasons", () => {
    tmp = createTmpDir();
    makeFlowWithAdditionTask(tmp);
    fs.writeFileSync(join(tmp, ".sdd-forge/config.json"), JSON.stringify({
      lang: "ja", type: "base",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      flow: { retry: { max: 5 } },
      agent: { default: "claude/opus", timeout: 300 },
    }));
    const stub = writeStubAgent(tmp);
    const logPath = join(tmp, "stub.log");
    fs.writeFileSync(logPath, "");
    const out = execFileSync(
      "node", [FLOW_CMD, "run", "draft-task", "--task-id", "T-add"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          SDD_FORGE_WORK_ROOT: tmp,
          SDD_FORGE_AGENT_STUB: stub,
          SDD_FORGE_STUB_LOG: logPath,
        },
        cwd: tmp,
      },
    );
    const env = JSON.parse(out);
    assert.equal(env.ok, true, "command should succeed after retry");
    assert.ok(env.data?.attempts >= 2, "should take at least 2 attempts (attempt 1 FAILs)");

    const log = fs.readFileSync(logPath, "utf8");
    const parts = log.split(/----ATTEMPT \d+----\n/).filter(Boolean);
    assert.ok(parts.length >= 2, "log must contain at least 2 attempts");

    assert.ok(!/Previous attempt failed — reasons/.test(parts[0]),
      "initial attempt prompt must not include retry feedback section");

    assert.ok(/## Previous attempt failed — reasons/.test(parts[1]),
      "retry prompt must include 'Previous attempt failed — reasons' section with prior FAIL reasons");
  });
});
