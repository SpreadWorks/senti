// spec: R1 R2 R3 R13 R21 R27 R36
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertContains, read } from "./helpers.js";

describe("spec 257: preparation, config, and analysis contracts", () => {
  it("R1: prepare-spec runs docs scan and fails on missing or invalid analysis.json", () => {
    const src = read("src/flow/lib/run-prepare-spec.js");
    assert.match(src, /scan|docs/i, "prepare-spec must run docs scan");
    assert.match(src, /analysis\.json/, "prepare-spec must require analysis.json");
    assert.match(src, /dry-?run/i, "prepare-spec must skip docs scan for dry-run");
    assert.match(src, /throw|Envelope\.fail|ok:\s*false/, "prepare-spec must fail instead of continuing");
  });

  it("R2: analysis category iteration is centralized and used by analysis walkers", () => {
    assertContains("src/docs/lib/analysis-entry.js", /iterateAnalysisCategories/, "must expose iterateAnalysisCategories");
    assertContains("src/docs/lib/analysis-entry.js", /entries/, "must recognize category entries");
    assertContains("src/docs/lib/analysis-entry.js", /dataSourceHash|summary/, "must allow summary/dataSourceHash metadata");
    for (const relPath of [
      "src/check/commands/scan.js",
      "src/docs/commands/enrich.js",
      "src/docs/commands/text.js",
      "src/docs/commands/review.js",
      "src/docs/lib/analysis-filter.js",
    ]) {
      assertContains(relPath, /iterateAnalysisCategories/, "must use shared analysis iterator");
    }
  });

  it("R3: config loading validates top-level test config and preserves invalid config failures", () => {
    const config = read("src/lib/config.js");
    assert.match(config, /\btest\b/, "config schema must include top-level test object");
    assert.match(config, /command/, "test.command must be validated");
    assert.match(config, /projectPaths/, "test.projectPaths must be validated");
    assert.match(config, /timeout/, "test.timeout must be validated");
    assert.match(config, /absolute|parent|\.\.|glob|metachar|shell/i, "path validation must reject unsafe values");

    const container = read("src/lib/container.js");
    assert.match(container, /config/i, "container must handle config startup");
    assert.doesNotMatch(container, /catch[\s\S]{0,240}config\s*=\s*null[\s\S]{0,240}NO_CONFIG/, "invalid config must not be downgraded to NO_CONFIG");
  });

  it("R13: prerequisite failures do not write normal test-execute-result.json artifacts", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    assert.match(src, /command discovery|discover|config|analysis|spawn/i, "test-execute must distinguish prerequisite checks");
    assert.match(src, /issue-log|issueLog|setIssue/i, "test-execute prerequisite failures must be recorded in issue-log");
    assert.match(src, /started/i, "test-execute must know whether the regression command started");
    assert.match(src, /test-execute-result\.json/, "test-execute must own the normal artifact");
  });

  it("R21: schema version uses supported enum and cross-field checks stay in code", () => {
    const schema = JSON.parse(read("src/flow/schemas/test-execute-result.schema.json"));
    assert.deepEqual(schema?.properties?.version?.enum, ["2"], "version must be enum ['2']");
    assert.equal(schema?.properties?.version?.const, undefined, "unsupported const must not be used");
    assertContains("src/flow/lib/run-test-result-review.js", /validate|marker|changed_files|checked_items/i, "cross-field validation must be in code");
    assertContains("src/flow/lib/run-gate.js", /validate|marker|changed_files|checked_items/i, "gate must perform deterministic validation in code");
  });

  it("R27: generated docs use the same test command source order as runtime discovery", () => {
    const detection = read("src/docs/lib/test-env-detection.js");
    assert.match(detection, /test\.command|testCommand/i, "docs detection must include configured test.command");
    assert.match(detection, /package\.json|scripts\.test/i, "docs detection must include package.json scripts.test");
    assert.match(detection, /composer\.json|run-script/i, "docs detection must include composer.json scripts.test");
    assert.match(detection, /Makefile|make test/i, "docs detection must include Makefile test target");
    assertContains("src/presets/base/data/package.js", /composer|Makefile|test/i, "base data must expose test command metadata");
  });

  it("R36: localized runtime help/messages mention the new test artifact and config wording", () => {
    for (const relPath of [
      "src/locale/en/ui.json",
      "src/locale/en/messages.json",
      "src/locale/ja/ui.json",
      "src/locale/ja/messages.json",
    ]) {
      assertContains(relPath, /test|artifact|config|regression|project/i, "localized text must cover updated test wording");
    }
  });
});
