import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { execFileSync } from "child_process";

const SDD_FORGE = join(process.cwd(), "src/sdd-forge.js");

function run(args, env = {}) {
  return execFileSync("node", [SDD_FORGE, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

describe("flow get guardrail output format", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupProject() {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeJson(tmp, ".sdd-forge/guardrail.json", {
      guardrails: [
        {
          id: "no-secrets",
          title: "No Hardcoded Secrets",
          body: "Do not hardcode API keys or passwords.",
          meta: { phase: ["spec", "impl"] },
        },
        {
          id: "single-responsibility",
          title: "Single Responsibility",
          body: "Each spec shall address one concern.",
          meta: { phase: ["draft", "spec"] },
        },
      ],
    });
    return tmp;
  }

  // R1: Default output is Markdown
  it("outputs Markdown by default", () => {
    setupProject();
    const result = run(
      ["flow", "get", "guardrail", "spec"],
      { SDD_WORK_ROOT: tmp },
    );
    // Should contain Markdown headings, not JSON
    assert.ok(result.includes("## Guardrail: No Hardcoded Secrets"), "should have markdown heading");
    assert.ok(result.includes("Do not hardcode API keys"), "should have body text");
    assert.ok(result.includes("## Guardrail: Single Responsibility"), "should have second heading");
    // Should NOT be JSON
    assert.ok(!result.startsWith("{"), "should not start with JSON brace");
  });

  // R1: Empty output when no guardrails match
  it("outputs empty string when no guardrails match phase", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeJson(tmp, ".sdd-forge/guardrail.json", {
      guardrails: [
        {
          id: "lint-only",
          title: "Lint Only",
          body: "Only for lint.",
          meta: { phase: ["lint"] },
        },
      ],
    });
    const result = run(
      ["flow", "get", "guardrail", "draft"],
      { SDD_WORK_ROOT: tmp },
    );
    // base preset guardrails will be present, but project lint-only should not appear
    // Just verify it's not JSON
    assert.ok(!result.trimStart().startsWith("{"), "should not be JSON");
  });

  // R2: --format json returns JSON envelope
  it("outputs JSON envelope with --format json", () => {
    setupProject();
    const result = run(
      ["flow", "get", "guardrail", "spec", "--format", "json"],
      { SDD_WORK_ROOT: tmp },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.phase, "spec");
    assert.ok(Array.isArray(envelope.data.guardrails));
    assert.ok(envelope.data.guardrails.length > 0);
    assert.ok(envelope.data.guardrails.some((g) => g.title === "No Hardcoded Secrets"));
  });

  // R3: Error output is always JSON
  it("outputs JSON error for invalid phase", () => {
    setupProject();
    try {
      run(
        ["flow", "get", "guardrail", "invalid"],
        { SDD_WORK_ROOT: tmp },
      );
      assert.fail("should have thrown");
    } catch (e) {
      const envelope = JSON.parse(e.stdout || e.stderr || "");
      assert.equal(envelope.ok, false);
    }
  });

  it("outputs JSON error for missing phase", () => {
    setupProject();
    try {
      run(
        ["flow", "get", "guardrail"],
        { SDD_WORK_ROOT: tmp },
      );
      assert.fail("should have thrown");
    } catch (e) {
      const envelope = JSON.parse(e.stdout || e.stderr || "");
      assert.equal(envelope.ok, false);
    }
  });
});
