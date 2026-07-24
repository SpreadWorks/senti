import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import { validateFinalRegressionResult } from "../../../src/flow/lib/test-artifacts.js";
import {
  CompletionValidator,
  contractFromFinalRegressionArtifact,
} from "../../../src/flow/lib/flow-judgment-contract.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { generateReport } from "../../../src/flow/commands/report.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../helpers/git-repo.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";

const SPEC_DIR = "specs/001-record-proceed";
const FIXTURE_PATH = "final-regression-fixture.sh";

function setupProject(tmp, scriptBody) {
  fs.mkdirSync(path.join(tmp, ".senti"), { recursive: true });
  writeFile(tmp, `${SPEC_DIR}/spec.md`, "# Spec\n");
  writeFile(tmp, FIXTURE_PATH, scriptBody);
  initGitRepo(tmp);
  commitAll(tmp, "initial");
  return {
    root: tmp,
    config: { test: { command: `sh ${FIXTURE_PATH}`, timeout: 5 } },
    flowState: {
      spec: `${SPEC_DIR}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-record-proceed",
    },
  };
}

function failingFixtureBody(message) {
  return `printf '%s\\n' ${JSON.stringify(message)} >&2\nexit 1\n`;
}

function readArtifact(tmp) {
  return validateFinalRegressionResult(JSON.parse(
    fs.readFileSync(path.join(tmp, SPEC_DIR, "final-regression-result.json"), "utf8"),
  ));
}

function failedRecordedArtifact(overrides = {}) {
  return {
    version: "1",
    completed: true,
    result: "fail",
    failureKind: "unattributed_existing_failure",
    failureCategory: "existing_failure",
    failureNature: "assertion",
    command: "npm test --",
    commandSource: "package.json",
    rawOutputPath: "specs/001/tests/.raw/final-regression-attempt-002.log",
    rawOutputLines: { start_line: 1, end_line: 4 },
    process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
    changedFiles: [],
    changedFileFingerprints: [],
    commandIdentity: {
      command: "npm test --",
      commandSource: "package.json",
      argv: ["npm", "test", "--"],
      env: {},
      source: "config",
      metadata: {},
      resolvedScriptDigest: null,
      resolvedConfigDigest: null,
    },
    recordAndProceed: {
      eligible: true,
      validated: true,
      evidence: "existing failure remained after an attempted repair",
    },
    selectedAction: "record-and-proceed",
    remainingRisk: "full regression remains red for an existing failure",
    fixAttempts: 1,
    retryable: false,
    nextAction: "report",
    nextRecommendedAction: "record-and-proceed",
    failureSummary: "existing failure",
    ...overrides,
  };
}

describe("final-regression record-and-proceed shared unit coverage", () => {
  test("runner records eligible existing failures with Issue 403 category and recommendation", async () => {
    const tmp = createTmpDir("unit-final-regression-record-proceed-runner-");
    try {
      const ctx = setupProject(tmp, failingFixtureBody("existing failure"));

      await new RunFinalRegressionCommand().execute(ctx);
      const artifact = readArtifact(tmp);

      assert.equal(artifact.result, "fail");
      assert.equal(artifact.failureCategory, "existing_failure");
      assert.equal(artifact.recordAndProceed.eligible, true);
      assert.equal(artifact.nextRecommendedAction, "fix-and-rerun");
    } finally {
      removeTmpDir(tmp);
    }
  });

  test("schema accepts failed-recorded artifacts and rejects invalid failed completion", () => {
    assert.equal(validateFinalRegressionResult(failedRecordedArtifact()).result, "fail");
    assert.throws(() => validateFinalRegressionResult(failedRecordedArtifact({
      recordAndProceed: { eligible: true, validated: false, evidence: "" },
    })), /record-and-proceed evidence/i);
  });

  test("registry and completion policy complete only validated failed-recorded artifacts", async () => {
    const validator = new CompletionValidator();
    const contract = contractFromFinalRegressionArtifact(failedRecordedArtifact(), {
      artifactPath: "specs/001/final-regression-result.json",
    });
    assert.equal(validator.validate({ contract, requestedStatus: "done" }).kind, "normal");

    const tmp = createTmpDir("unit-final-regression-record-proceed-registry-");
    try {
      const specDir = "specs/001";
      const updated = [];
      const flowState = moveFlowToStep(makeFlowState({
        spec: `${specDir}/spec.json`,
        runId: "run-final-regression-recorded",
        tasks: [],
        currentTaskId: null,
      }), "final-regression");
      writeFile(tmp, `${specDir}/spec.json`, JSON.stringify({ requirements: [] }, null, 2));
      writeFile(tmp, `${specDir}/final-regression-result.json`, JSON.stringify(failedRecordedArtifact(), null, 2));
      await FLOW_COMMANDS.run["final-regression"].post({
        root: tmp,
        specId: "001",
        flowState,
        flowManager: {
          load: () => flowState,
          updateStepStatus(transition) {
            updated.push({ stepId: transition.stepId, status: transition.requestedStatus });
          },
        },
      }, { result: "fail", failedRecorded: true });

      assert.deepEqual(updated.at(-1), { stepId: "final-regression", status: "done" });
    } finally {
      removeTmpDir(tmp);
    }
  });

  test("registry post-hook accepts stale-evidence recovery without a final artifact", async () => {
    const updated = [];
    await FLOW_COMMANDS.run["final-regression"].post({
      root: "/unused",
      flowState: {},
      flowManager: {
        updateStepStatus(transition) {
          updated.push(transition);
        },
      },
    }, {
      result: "recovered",
      artifacts: {
        evidenceRefresh: { recovered: true },
      },
    });

    assert.deepEqual(updated, []);
  });

  test("prompt and report expose auto recommendation and failed-recorded non-pass details", () => {
    const prompt = fs.readFileSync("src/flow/prompts/impl/final-regression.md", "utf8");
    assert.match(prompt, /auto(?:Approve| mode).*recommended action/i);

    const { data, text } = generateReport({
      state: { spec: "specs/001/spec.md", steps: [], metrics: [], tasks: [] },
      results: { finalRegression: failedRecordedArtifact() },
      issueLog: { entries: [] },
      implDiffStat: null,
      commitMessages: [],
    });

    assert.equal(data.tests.finalRegression.result, "fail");
    assert.equal(data.tests.finalRegression.failureCategory, "existing_failure");
    assert.match(text, /Final regression: result=fail/);
    assert.match(text, /selectedAction=record-and-proceed/);
    assert.doesNotMatch(text, /Final regression: result=pass/);
  });
});
