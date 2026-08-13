import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import RunTestResultReviewCommand from "../../../src/flow/lib/run-test-result-review.js";
import {
  completeScenarioValidityArtifactChange,
  completeTestExecuteArtifactChange,
} from "../../../src/flow/lib/test-artifacts.js";
import { createAcceptanceReviewFixture } from "../../helpers/acceptance-review-fixture.js";

test("test-result review resumes from structured evidence when the transient execution log is absent", async (t) => {
  const fixture = createAcceptanceReviewFixture({ specPath: "specs/001-test/spec.json" });
  t.after(() => fixture.cleanup());
  fs.rmSync(path.join(fixture.root, fixture.executionRaw), { force: true });

  const result = await new RunTestResultReviewCommand().execute({
    root: fixture.root,
    executionRoot: fixture.root,
    flowState: fixture.state,
    flowManager: fixture.flowManager,
  });

  assert.equal(result.result, "ok");
  const review = JSON.parse(fs.readFileSync(path.join(fixture.specDir, "test-result-review.json"), "utf8"));
  assert.equal(review.verdict, "pass");
  assert.equal(review.checked_items.every((entry) => entry.result === "pass"), true);
});

test("completion decisions trust structured scenario and test results when transient logs are absent", async (t) => {
  const fixture = createAcceptanceReviewFixture({ specPath: "specs/001-test/spec.json" });
  t.after(() => fixture.cleanup());
  fs.rmSync(path.join(fixture.root, fixture.scenarioRaw), { force: true });
  fs.rmSync(path.join(fixture.root, fixture.executionRaw), { force: true });
  fs.writeFileSync(path.join(fixture.specDir, "file-map.json"), `${JSON.stringify({ R1: [fixture.specPath] })}\n`);

  const scenario = JSON.parse(fs.readFileSync(path.join(fixture.specDir, "scenario-validity-result.json"), "utf8"));
  const execution = JSON.parse(fs.readFileSync(path.join(fixture.specDir, "test-execute-result.json"), "utf8"));
  const scenarioDecision = await completeScenarioValidityArtifactChange({
    root: fixture.root,
    specDir: fixture.specDir,
    artifact: scenario,
  });
  const executionDecision = await completeTestExecuteArtifactChange({
    root: fixture.root,
    specDir: fixture.specDir,
    artifact: execution,
  });

  assert.equal(scenarioDecision.constructor.name, "ArtifactCompletionSuccess");
  assert.equal(executionDecision.constructor.name, "ArtifactCompletionSuccess");
});
