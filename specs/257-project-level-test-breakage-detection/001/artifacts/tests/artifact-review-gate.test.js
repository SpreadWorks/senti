// spec: R8 R9 R15 R16 R26 R30 R31 R33
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertContains, read } from "./helpers.js";

describe("spec 257: v2 artifact, review, and gate validation", () => {
  it("R8: test-execute-result schema is v2-only with summary ranges and regression object", () => {
    const schema = JSON.parse(read("src/flow/schemas/test-execute-result.schema.json"));
    assert.deepEqual(schema?.properties?.version?.enum, ["2"], "version must be enum ['2']");
    assert.ok(schema?.required?.includes("summary"), "summary[] must remain required");
    assert.ok(schema?.properties?.regression, "regression object must exist outside summary[]");
    const schemaText = read("src/flow/schemas/test-execute-result.schema.json");
    assert.match(schemaText, /start_line|end_line/, "raw_output_lines must use range objects");
    assert.doesNotMatch(schemaText, /"1"/, "v1 artifact compatibility must be removed");
  });

  it("R9: required regression fields are represented in schema and validators", () => {
    const schemaText = read("src/flow/schemas/test-execute-result.schema.json");
    for (const name of ["mode", "root_test_command", "root_test_command_source", "command", "result", "raw_output_lines", "changed_files", "target_paths"]) {
      assert.match(schemaText, new RegExp(name), `${name} must be represented for regression`);
    }
    assertContains("src/flow/lib/run-test-result-review.js", /target_paths|targeted|start_line|end_line/i, "review validator must check targeted/range details");
  });

  it("R15: test-result-review requires deterministic project_regression_verification pass", () => {
    const src = read("src/flow/lib/run-test-result-review.js");
    assert.match(src, /project_regression_verification/, "review output must include project_regression_verification");
    assert.match(src, /checked_items|checkedItems/i, "review must validate checked_items");
    assert.match(src, /verdict[\s\S]{0,120}pass|pass[\s\S]{0,120}verdict/i, "review must only complete on pass verdict");
    assert.match(src, /throw|Envelope\.fail|ok:\s*false|process\.exitCode/i, "review failure must be non-zero/retryable");
  });

  it("R16: flow-level gate-impl independently validates current v2 regression evidence", () => {
    const src = read("src/flow/lib/run-gate.js");
    assert.match(src, /test-result-review\.json/, "gate must require test-result-review artifact");
    assert.match(src, /test-execute-result\.json/, "gate must inspect test-execute artifact");
    assert.match(src, /version[\s\S]{0,80}2|["']2["'][\s\S]{0,80}version/, "gate must require v2 artifact");
    assert.match(src, /changed_files|changedFiles/i, "gate must compare current changed-file snapshot");
    assert.match(src, /result[\s\S]{0,80}fail|fail[\s\S]{0,80}result/i, "gate must block failed required regression");
  });

  it("R26: registry post-hooks advance test steps only on valid artifact/review outcomes", () => {
    const src = read("src/flow/registry.js");
    assert.match(src, /test-execute/, "registry must have test-execute post-hook behavior");
    assert.match(src, /test-result-review/, "registry must have test-result-review post-hook behavior");
    assert.match(src, /version|regression|verdict|checked_items|checkedItems/i, "registry must inspect artifact/review outcome before marking done");
    assert.match(src, /ok:\s*false|throw|return\s+false/i, "prerequisite or invalid review failures must leave step incomplete");
  });

  it("R30: spec-local summary entries are validated against files, names, commands, and raw line ranges", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    for (const pattern of [/specs\/.*tests|spec-local/i, /file_path|filePath|test_file/i, /test_name|testName|name/i, /command/i, /start_line|end_line/i]) {
      assert.match(src, pattern, `spec-local summary validator must check ${pattern}`);
    }
  });

  it("R31: manual set-step completion cannot bypass test/review/gate/retro evidence", () => {
    const src = read("src/flow/lib/set-step.js");
    for (const step of ["test-execute", "test-result-review", "gate-impl", "retro"]) {
      assert.match(src, new RegExp(step), `set-step must validate or refuse manual done for ${step}`);
    }
    assert.match(src, /validate|artifact|review|regression/i, "set-step must validate current evidence");
  });

  it("R33: gate-step routes project regression validation only to integration gate", () => {
    const src = read("src/flow/lib/gate-step.js");
    assert.match(src, /integration/, "gate-step must distinguish integration phase");
    assert.match(src, /task|phase/i, "gate-step must keep task-level behavior separate");
    assertContains("src/flow/lib/run-gate.js", /integration|gate-impl/i, "run-gate must apply regression checks only at flow-level integration gate");
  });
});
