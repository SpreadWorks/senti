import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(__dirname, "../../../src");

describe("single-responsibility guardrail body (R1)", () => {
  const guardrailPath = resolve(srcRoot, "presets/base/guardrail.json");
  const guardrails = JSON.parse(readFileSync(guardrailPath, "utf8"));
  const sr = guardrails.guardrails.find((g) => g.id === "single-responsibility");

  it("guardrail entry exists with unchanged id/title/meta", () => {
    assert.ok(sr, "single-responsibility guardrail must exist");
    assert.equal(sr.title, "Single Responsibility");
    assert.deepEqual(sr.meta.phase, ["draft", "spec"]);
    assert.equal(sr.meta.category, "process");
  });

  it("body states that user-defined Issue/request scope shall be respected", () => {
    assert.match(
      sr.body,
      /issue|request/i,
      "body must reference Issue or request as scope source"
    );
  });

  it("body prohibits AI from proposing scope splitting", () => {
    assert.match(
      sr.body,
      /shall not|do not|must not/i,
      "body must contain a prohibition on AI-initiated scope splitting"
    );
  });
});

describe("draft.md concern-unit note (R2)", () => {
  const draftPromptPath = resolve(srcRoot, "flow/prompts/plan/draft.md");
  const content = readFileSync(draftPromptPath, "utf8");
  const firstLine = content.split("\n")[0];

  it("first line does not mention spec splitting", () => {
    assert.doesNotMatch(
      firstLine,
      /spec.*分割|split.*spec|各要件群が単一 concern に収まるよう/i,
      "first line must not suggest splitting the spec itself"
    );
  });

  it("first line references task decomposition context", () => {
    assert.match(
      firstLine,
      /task|タスク/i,
      "first line must reference task decomposition"
    );
  });

  it("first line references task-single-responsibility guardrail", () => {
    assert.match(
      firstLine,
      /task-single-responsibility/,
      "first line must reference the task-single-responsibility guardrail"
    );
  });
});
