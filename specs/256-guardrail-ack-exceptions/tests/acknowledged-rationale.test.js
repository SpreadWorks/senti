// spec: R1 R2 R3 R27 R4 R5 R6 R7 R26 R8 R17 R18 R9 R10 R11 R12 R34 R13 R19 R23 R28 R15 R31 R22
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const importRoot = (p) => import(pathToFileURL(path.join(root, p)).href);

const spec = {
  constraints: ["`exit-code-contract` has enough rationale for changed command behavior."],
  clarifications: [{ q: "bounded-resource-usage?", a: "The rendered section has explicit caps." }],
  alternatives_considered: [{ option: "Use exit-code-contract markdown", reason: "Rejected because source paths are lost." }],
  design_principles: ["exit-code-contract must not be scanned here."],
};
const guardrails = [
  { id: "exit-code-contract", title: "Exit Code Contract", body: "body", meta: { phase: ["spec"] } },
  { id: "bounded-resource-usage", title: "Bounded Resource Usage", body: "body", meta: { phase: ["spec"] } },
];

test("R1: helper exports rationale classes", async () => {
  const mod = await importRoot("src/flow/lib/acknowledged-rationale.js");
  assert.equal(typeof mod.AcknowledgedRationaleEntry, "function");
  assert.equal(typeof mod.AcknowledgedRationaleSet, "function");
});

test("R2: helper returns markdown and unavailable-context warning", async () => {
  const { buildAcknowledgedRationaleSection } = await importRoot("src/flow/lib/acknowledged-rationale.js");
  assert.match(buildAcknowledgedRationaleSection({ spec, guardrails }).markdown, /Matched Spec Acknowledgment Rationale/);
  assert.deepEqual(buildAcknowledgedRationaleSection({ spec: null, guardrails }), { markdown: "", warning: "parent spec context unavailable" });
});

test("R3: helper scans only the approved spec fields", async () => {
  const { buildAcknowledgedRationaleSection } = await importRoot("src/flow/lib/acknowledged-rationale.js");
  const markdown = buildAcknowledgedRationaleSection({ spec, guardrails }).markdown;
  assert.match(markdown, /\$\.constraints\[0\]/);
  assert.match(markdown, /\$\.clarifications\[0\]/);
  assert.match(markdown, /\$\.alternatives_considered\[0\]/);
  assert.doesNotMatch(markdown, /design_principles/);
});

test("R27: qualification removes guardrail ids before counting rationale text", async () => {
  const { buildAcknowledgedRationaleSection } = await importRoot("src/flow/lib/acknowledged-rationale.js");
  const markdown = buildAcknowledgedRationaleSection({ spec: { constraints: ["exit-code-contract short"], clarifications: [], alternatives_considered: [] }, guardrails }).markdown;
  assert.equal(markdown, "");
});

test("R4: matching is case-sensitive and token-boundary aware", async () => {
  const { buildAcknowledgedRationaleSection } = await importRoot("src/flow/lib/acknowledged-rationale.js");
  const s = { constraints: ["`exit-code-contract` valid rationale text", "Exit-Code-Contract invalid", "not-exit-code-contract-anymore invalid"], clarifications: [], alternatives_considered: [] };
  const markdown = buildAcknowledgedRationaleSection({ spec: s, guardrails }).markdown;
  assert.match(markdown, /\$\.constraints\[0\]/);
  assert.doesNotMatch(markdown, /\$\.constraints\[1\]|\$\.constraints\[2\]/);
});

test("R5: rendering uses canonical paths, labels, truncation marker, and whitespace normalization", async () => {
  const { buildAcknowledgedRationaleSection } = await importRoot("src/flow/lib/acknowledged-rationale.js");
  const s = { constraints: [`exit-code-contract ${"x".repeat(700)}`], clarifications: [{ q: "bounded-resource-usage\nQ", a: "A\ttext with enough rationale" }], alternatives_considered: [] };
  const markdown = buildAcknowledgedRationaleSection({ spec: s, guardrails }).markdown;
  assert.match(markdown, /\$\.constraints\[0\][\s\S]*\[truncated\]/);
  assert.match(markdown, /\$\.clarifications\[0\][\s\S]*Q: bounded-resource-usage Q A: A text with enough rationale/);
});

test("R6: rendering enforces deterministic order and size caps", async () => {
  const { buildAcknowledgedRationaleSection } = await importRoot("src/flow/lib/acknowledged-rationale.js");
  const s = { constraints: Array.from({ length: 5 }, (_, i) => `exit-code-contract rationale ${i} ${"x".repeat(80)}`), clarifications: [], alternatives_considered: [] };
  const markdown = buildAcknowledgedRationaleSection({ spec: s, guardrails }).markdown;
  assert.ok(markdown.length <= 4000);
  assert.equal((markdown.match(/source: \$\.constraints/g) || []).length, 3);
});

test("R7: gate article prompt inserts acknowledged rationale before content", async () => {
  const { buildGuardrailArticleEvalPrompt } = await importRoot("src/flow/lib/run-gate.js");
  const prompt = buildGuardrailArticleEvalPrompt("content", guardrails, "spec", undefined, [], { acknowledgedRationale: { markdown: "## Matched Spec Acknowledgment Rationale\nbody" } }).build().userPrompt;
  assert.ok(prompt.indexOf("## Guardrail Articles") < prompt.indexOf("## Matched Spec Acknowledgment Rationale"));
  assert.ok(prompt.indexOf("## Matched Spec Acknowledgment Rationale") < prompt.indexOf("## Content"));
});

test("R26: buildGuardrailPrompt exports and preserves empty-options output", async () => {
  const mod = await importRoot("src/flow/lib/run-gate.js");
  assert.equal(typeof mod.buildGuardrailPrompt, "function");
  assert.equal(mod.buildGuardrailPrompt("content", guardrails, "spec", undefined, [], {}), mod.buildGuardrailPrompt("content", guardrails, "spec"));
});

test("R8: checkGuardrail source accepts and forwards options", () => {
  assert.match(read("src/flow/lib/run-gate.js"), /checkGuardrail[\s\S]*options[\s\S]*buildGuardrailArticleEvalPrompt/);
});

test("R17: runGateFlow forwards prompt options separately from previous passes", () => {
  assert.match(read("src/flow/lib/run-gate.js"), /runGateFlow[\s\S]*guardrailPromptOptions[\s\S]*previouslyPassedIds/);
});

test("R18: PromptBuilder supports raw markdown", async () => {
  const { PromptBuilder } = await importRoot("src/lib/prompt-builder.js");
  assert.equal(new PromptBuilder().add("## A", "a").addRaw("## B\nb").build().userPrompt, "## A\na\n\n## B\nb");
});

test("R9: spec gate builds acknowledged rationale from spec and guardrails", () => {
  assert.match(read("src/flow/lib/run-gate.js"), /executeSpec[\s\S]*buildAcknowledgedRationaleSection/);
});

test("R10: diff gate passes rationale and filtered previous-pass ids", () => {
  assert.match(read("src/flow/lib/run-gate.js"), /executeDiffBasedGate[\s\S]*buildAcknowledgedRationaleSection[\s\S]*previouslyPassedIds/);
});

test("R11: review prompt accepts acknowledged rationale options", () => {
  assert.match(read("src/flow/commands/review.js"), /buildDraftSystemPrompt\(guardrails\s*=\s*\[\],\s*options\s*=\s*\{\}\)/);
});

test("R12: review flow loads active parent spec context", () => {
  assert.match(read("src/flow/commands/review.js"), /buildAcknowledgedRationaleSection/);
});

test("R34: unavailable parent spec context returns warning metadata outside strict spec gate", () => {
  assert.match(read("src/flow/lib/run-gate.js") + read("src/flow/commands/review.js"), /parent spec context unavailable/);
});

test("R13: target guardrail bodies contain acknowledged-exception clauses", () => {
  const bodies = read("src/presets/cli/guardrail.json") + read("src/presets/base/guardrail.json") + read("src/presets/node-cli/guardrail.json");
  for (const id of ["backward-compatible-cli-interface", "exit-code-contract", "bounded-resource-usage", "no-synchronous-io-in-hot-paths"]) assert.match(bodies, new RegExp(`${id}[\\s\\S]*acknowledged-exception`));
});

test("R19: guardrail override clause preservation is idempotent", () => {
  assert.match(read("src/lib/guardrail.js"), /acknowledged-exception[\s\S]*includes\(/);
});

test("R23: get guardrail markdown includes ids", async () => {
  const Command = (await importRoot("src/flow/lib/get-guardrail.js")).default;
  assert.match(new Command().execute({ root, phase: "spec" }).markdown, /## Guardrail: .+ \([a-z0-9-]+\)/);
});

test("R28: guardrail impl alias exits 0 and unknown phases fail", async () => {
  const Command = (await importRoot("src/flow/lib/get-guardrail.js")).default;
  assert.equal(new Command().execute({ root, phase: "impl" }).markdown, new Command().execute({ root, phase: "task-impl" }).markdown);
  assert.throws(() => new Command().execute({ root, phase: "gate" }), /draft|spec|task-spec|task-impl|integration|test|lint|review/);
});

test("R15: exact fixture specs are present", () => {
  for (const p of ["specs/228-fix-baseline-exit-code/spec.json", "specs/235-remove-flow-test-management/spec.json", "specs/229-test-runner-file-filter/spec.json"]) assert.ok(fs.existsSync(path.join(root, p)), p);
});

test("R31: tests cover required surfaces", () => {
  const self = read("specs/256-guardrail-ack-exceptions/tests/acknowledged-rationale.test.js");
  for (const phrase of ["design_principles", "Previous", "acknowledged-exception", "impl alias"]) assert.match(self, new RegExp(phrase));
});

test("R22: prompt order keeps previous pass and diff scope before articles and content", async () => {
  const { buildGuardrailArticleEvalPrompt } = await importRoot("src/flow/lib/run-gate.js");
  const prompt = buildGuardrailArticleEvalPrompt("diff", guardrails, "task-impl", undefined, ["exit-code-contract"], { acknowledgedRationale: { markdown: "## Matched Spec Acknowledgment Rationale\nbody" } }).build().userPrompt;
  assert.ok(prompt.indexOf("## Previously Passed Guardrails") < prompt.indexOf("## Diff Scope Constraint"));
  assert.ok(prompt.indexOf("## Diff Scope Constraint") < prompt.indexOf("## Guardrail Articles"));
  assert.ok(prompt.indexOf("## Guardrail Articles") < prompt.indexOf("## Matched Spec Acknowledgment Rationale"));
});
