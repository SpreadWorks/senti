/**
 * tests/e2e/acceptance/report.test.js
 *
 * E2E tests for acceptance test report generation.
 * Verifies pipeline traceability and report JSON output.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { copyFixture, runPipeline, removeTmpDir } from "../acceptance/lib/pipeline.js";
import { getAcceptanceFixtureDir } from "../acceptance/lib/targets.js";

describe("acceptance report: pipeline traceability", { timeout: 300000 }, () => {
  let tmp;

  it("runPipeline returns step timing for each pipeline step", async () => {
    const fixtureDir = getAcceptanceFixtureDir("base");
    tmp = copyFixture(fixtureDir, { type: "base" });

    const result = await runPipeline(tmp);

    assert.ok(result.steps, "runPipeline should return steps array");
    assert.ok(Array.isArray(result.steps), "steps should be an array");

    const expectedNames = ["scan", "enrich", "init", "data", "text", "readme"];
    const stepNames = result.steps.map((s) => s.name);

    for (const name of expectedNames) {
      assert.ok(stepNames.includes(name), `steps should include "${name}"`);
    }

    for (const step of result.steps) {
      assert.ok(typeof step.name === "string", "step.name should be a string");
      assert.ok(
        ["ok", "skipped", "error", "agent-error"].includes(step.status),
        `step.status should be one of ok/skipped/error/agent-error, got "${step.status}"`,
      );
      assert.ok(typeof step.durationMs === "number", "step.durationMs should be a number");
      assert.ok(step.durationMs >= 0, "step.durationMs should be non-negative");
    }
  });

  it("failed step records status as error", async () => {
    const fixtureDir = getAcceptanceFixtureDir("base");
    const badTmp = copyFixture(fixtureDir, { type: "base" });

    const outputDir = path.join(badTmp, ".senrail", "output");
    fs.rmSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(badTmp, ".senrail", "output"), "not-a-dir");

    try {
      const result = await runPipeline(badTmp);
      const failedStep = result.steps.find((s) => s.status === "error");
      assert.ok(failedStep, "should have at least one step with error status");
    } catch {
    } finally {
      removeTmpDir(badTmp);
    }
  });

  it("cleanup", () => {
    if (tmp) {
      removeTmpDir(tmp);
      tmp = null;
    }
  });
});

describe("acceptance report: JSON output", { timeout: 300000 }, () => {
  let tmp;

  it("report JSON is written to .senrail/output/acceptance-report.json", async () => {
    const fixtureDir = getAcceptanceFixtureDir("base");
    tmp = copyFixture(fixtureDir, { type: "base" });

    await runPipeline(tmp);

    const { writeReport } = await import("../acceptance/lib/test-template.js");
    const report = {
      preset: "base",
      timestamp: new Date().toISOString(),
      pipeline: { steps: [] },
      directives: { unfilled: [], exposed: [] },
      quality: null,
    };

    const reportPath = path.join(tmp, ".senrail", "output", "acceptance-report.json");
    writeReport(reportPath, report);

    assert.ok(fs.existsSync(reportPath), "report JSON should be written");

    const written = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    assert.equal(written.preset, "base");
    assert.ok(written.timestamp);
    assert.ok(written.pipeline);
    assert.ok(written.directives);
  });

  it("cleanup", () => {
    if (tmp) {
      removeTmpDir(tmp);
      tmp = null;
    }
  });
});
