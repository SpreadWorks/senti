import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

const ciPresetDir = path.join(ROOT, "src/presets/ci");
const gaPresetDir = path.join(ROOT, "src/presets/github-actions");

describe("136-github-actions-preset: spec verification", () => {

  // Req 1: DataSource moved to github-actions
  it("github-actions/data/pipelines.js exists", () => {
    assert.ok(
      fs.existsSync(path.join(gaPresetDir, "data/pipelines.js")),
      "github-actions/data/pipelines.js should exist"
    );
  });

  it("ci/data/pipelines.js does not exist", () => {
    assert.ok(
      !fs.existsSync(path.join(ciPresetDir, "data/pipelines.js")),
      "ci/data/pipelines.js should be removed"
    );
  });

  // Req 2: scan.include moved to github-actions
  it("github-actions/preset.json has scan.include", () => {
    const preset = JSON.parse(fs.readFileSync(path.join(gaPresetDir, "preset.json"), "utf8"));
    assert.ok(preset.scan, "github-actions preset should have scan");
    assert.ok(Array.isArray(preset.scan.include), "scan.include should be an array");
    assert.ok(
      preset.scan.include.some(p => p.includes(".github/workflows")),
      "scan.include should contain .github/workflows pattern"
    );
  });

  it("ci/preset.json does not have scan.include", () => {
    const preset = JSON.parse(fs.readFileSync(path.join(ciPresetDir, "preset.json"), "utf8"));
    assert.ok(!preset.scan, "ci preset should not have scan");
  });

  // Req 3: ci template uses {{text}} not {{data}}
  it("ci/templates/en/ci_cd.md uses {{text}} in blocks", () => {
    const content = fs.readFileSync(path.join(ciPresetDir, "templates/en/ci_cd.md"), "utf8");
    assert.ok(!content.includes('{{data('), "ci template should not contain {{data}} directives");
    assert.ok(content.includes('{{text('), "ci template should contain {{text}} directives");
    assert.ok(content.includes('{%block'), "ci template should contain {%block} directives");
  });

  it("ci/templates/ja/ci_cd.md uses {{text}} in blocks", () => {
    const content = fs.readFileSync(path.join(ciPresetDir, "templates/ja/ci_cd.md"), "utf8");
    assert.ok(!content.includes('{{data('), "ci template should not contain {{data}} directives");
    assert.ok(content.includes('{{text('), "ci template should contain {{text}} directives");
    assert.ok(content.includes('{%block'), "ci template should contain {%block} directives");
  });

  // Req 4: github-actions template uses {{data}} with extends
  it("github-actions/templates/en/ci_cd.md uses {{data}} with extends", () => {
    const content = fs.readFileSync(path.join(gaPresetDir, "templates/en/ci_cd.md"), "utf8");
    assert.ok(content.includes('{%extends%}'), "should extend parent template");
    assert.ok(
      content.includes('{{data("github-actions.pipelines.'),
      "should use {{data(\"github-actions.pipelines.*\")}} directives"
    );
  });

  it("github-actions/templates/ja/ci_cd.md uses {{data}} with extends", () => {
    const content = fs.readFileSync(path.join(gaPresetDir, "templates/ja/ci_cd.md"), "utf8");
    assert.ok(content.includes('{%extends%}'), "should extend parent template");
    assert.ok(
      content.includes('{{data("github-actions.pipelines.'),
      "should use {{data(\"github-actions.pipelines.*\")}} directives"
    );
  });

  // Req 5: aliases removed
  it("ci/preset.json aliases does not contain github-actions", () => {
    const preset = JSON.parse(fs.readFileSync(path.join(ciPresetDir, "preset.json"), "utf8"));
    const aliases = preset.aliases || [];
    assert.ok(
      !aliases.includes("github-actions"),
      "ci aliases should not contain 'github-actions'"
    );
  });

  // Req 7: test file renamed
  it("github-actions-pipelines.test.js exists in tests/unit/presets/", () => {
    assert.ok(
      fs.existsSync(path.join(ROOT, "tests/unit/presets/github-actions-pipelines.test.js")),
      "github-actions-pipelines.test.js should exist"
    );
  });

  it("ci-pipelines.test.js does not exist in tests/unit/presets/", () => {
    assert.ok(
      !fs.existsSync(path.join(ROOT, "tests/unit/presets/ci-pipelines.test.js")),
      "ci-pipelines.test.js should be removed"
    );
  });
});
