// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseEvaluationResponse } from "../../../src/flow/lib/run-gate.js";
import { enumerateUsableRequirementIds } from "../../../src/lib/spec-json.js";
import { defaultPassResponse } from "../../../tests/helpers/stub-agent.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

function passResponseFor(...ids) {
  return JSON.stringify({
    evaluations: ids.map((id) => ({
      guardrail_id: id,
      result: "pass",
      reason: `stub pass for ${id}`,
    })),
  });
}

test("R1: spec.json IDs are usable without file-map.json", () => {
  assert.deepEqual(
    enumerateUsableRequirementIds({ requirements: [{ id: "R1" }] }),
    ["R1"],
  );
  assert.equal(parseEvaluationResponse(passResponseFor("R1"), ["R1"])[0].guardrail_id, "R1");
});

test("R2: file-map presence is not part of usable ID enumeration", () => {
  const spec = { requirements: [{ id: " R2 " }] };
  const absentFileMap = null;
  const presentFileMap = { R2: ["src/example.js"] };

  assert.deepEqual(enumerateUsableRequirementIds(spec, absentFileMap), ["R2"]);
  assert.deepEqual(enumerateUsableRequirementIds(spec, presentFileMap), ["R2"]);
});

test("R3: empty usable ID results allow callers to fall back to spec.md markers", () => {
  for (const spec of [
    {},
    { requirements: [] },
    { requirements: [{ id: "" }, { id: "   " }] },
  ]) {
    assert.deepEqual(enumerateUsableRequirementIds(spec), []);
  }
});

test("R4: malformed requirement entries do not throw or introduce schema validation", () => {
  assert.deepEqual(
    enumerateUsableRequirementIds({
      requirements: [
        null,
        undefined,
        "R4",
        { id: 4 },
        { id: " R4 " },
      ],
    }),
    ["R4"],
  );
});

test("R5: spec.json ID response is accepted and stale marker response is rejected", () => {
  assert.equal(parseEvaluationResponse(passResponseFor("R1"), ["R1"])[0].guardrail_id, "R1");
  assert.throws(
    () => parseEvaluationResponse(passResponseFor("REQ-SPEC"), ["R1"]),
    /unknown guardrail_id "REQ-SPEC"/,
  );
});

test("R6: spec.md fallback marker IDs remain accepted when spec.json has no usable IDs", () => {
  assert.deepEqual(enumerateUsableRequirementIds({ requirements: [{ id: " " }] }), []);
  assert.equal(
    parseEvaluationResponse(passResponseFor("REQ-FALLBACK"), ["REQ-FALLBACK"])[0].guardrail_id,
    "REQ-FALLBACK",
  );
});

test("R7: integration prechecks stay before shared source selection", () => {
  const runGate = fs.readFileSync(path.join(repoRoot, "src/flow/lib/run-gate.js"), "utf8");
  const executeStart = runGate.indexOf("async executeDiffBasedGate");
  const precheckIndex = runGate.indexOf(
    "checkIntegrationTestArtifacts(root, state, level, phase)",
    executeStart,
  );
  const selectionIndex = runGate.indexOf("enumerateUsableRequirementIds(specJson)", executeStart);

  assert.ok(precheckIndex >= 0, "integration artifact precheck call should remain");
  assert.ok(selectionIndex >= 0, "shared source selection helper should be used");
  assert.ok(precheckIndex < selectionIndex, "integration prechecks should happen first");
});

test("R8: shared helper trims, omits blanks, and de-dupes in first-seen order", () => {
  assert.deepEqual(
    enumerateUsableRequirementIds({
      requirements: [
        { id: " R8 " },
        { id: "R8" },
        { id: "R10" },
        { id: " " },
        { id: "R8" },
      ],
    }),
    ["R8", "R10"],
  );
});

test("R9: source-selection tests use local IDs without changing defaultPassResponse", () => {
  assert.equal(
    JSON.parse(defaultPassResponse()).evaluations[0].guardrail_id,
    "REQ-SPEC",
  );
  assert.equal(parseEvaluationResponse(passResponseFor("R9"), ["R9"])[0].guardrail_id, "R9");
});

test("R10: helper covers missing, empty, whitespace-only, duplicate, and malformed IDs", () => {
  assert.deepEqual(enumerateUsableRequirementIds({}), []);
  assert.deepEqual(enumerateUsableRequirementIds({ requirements: [] }), []);
  assert.deepEqual(
    enumerateUsableRequirementIds({
      requirements: [
        { id: "\t" },
        { id: " R10 " },
        { id: "R10" },
        { id: null },
        {},
      ],
    }),
    ["R10"],
  );
});

test("R11: malformed file-map content is not a requirement-ID fallback trigger", () => {
  const malformedFileMapLikeValue = { R11: 42 };
  assert.deepEqual(
    enumerateUsableRequirementIds(
      { requirements: [{ id: " R11 " }] },
      malformedFileMapLikeValue,
    ),
    ["R11"],
  );
});

test("R12: this spec-local test file declares every testable requirement in its header", () => {
  const content = fs.readFileSync(__filename, "utf8");
  const header = content.split("\n")[0];
  for (let i = 1; i <= 12; i += 1) {
    assert.match(header, new RegExp(`\\bR${i}\\b`));
    assert.match(content, new RegExp(`test\\("R${i}:`));
  }
});
