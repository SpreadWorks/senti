// spec: R4 R5 R6 R7 R10 R11 R12 R14 R20 R22 R23
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertContains, read } from "./helpers.js";

describe("spec 257: regression command discovery and classification", () => {
  it("R4: root regression discovery uses explicit config, ecosystem wrappers, and recorded source", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    assert.match(src, /test\.command|testCommand/i, "test.command must be first-class discovery source");
    assert.match(src, /package\.json[\s\S]{0,240}npm[\s\S]{0,120}test|npm[\s\S]{0,120}test[\s\S]{0,240}package\.json/i, "package scripts must execute through npm test wrapper");
    assert.match(src, /composer\.json[\s\S]{0,260}composer[\s\S]{0,160}run-script[\s\S]{0,80}test|composer[\s\S]{0,160}run-script[\s\S]{0,80}test[\s\S]{0,260}composer\.json/i, "composer scripts must execute through composer run-script test wrapper");
    assert.match(src, /Makefile[\s\S]{0,200}make[\s\S]{0,80}test|make[\s\S]{0,80}test[\s\S]{0,200}Makefile/i, "Makefile test must execute through make test wrapper");
    assert.match(src, /source|root_test_command_source/i, "selected source must be recorded");
  });

  it("R5: explicit test.command uses argv parsing and rejects shell syntax", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    assert.match(src, /argv|parse/i, "explicit test.command must be parsed to argv");
    assert.match(src, /KEY=value|env/i, "leading environment assignments must be handled");
    assert.match(src, /pipe|semicolon|redirection|subshell|glob|shell/i, "shell syntax must be rejected");
  });

  it("R6: changed file snapshots preserve status and rename details through a shared helper", () => {
    assertContains("src/lib/git-helpers.js", /renamed|old_path|oldPath|status|untracked/i, "git helper must preserve status and rename data");
    assertContains("src/flow/lib/run-test-execute.js", /changed_files|changedFiles/i, "test-execute must write changed_files");
    assertContains("src/flow/lib/run-gate.js", /changed_files|changedFiles/i, "gate must compare changed_files freshness");
    assertContains("src/flow/lib/run-test-execute.js", /git-helpers|listChanged|changedFiles/i, "test-execute must use shared changed-file helper");
    assertContains("src/flow/lib/run-gate.js", /git-helpers|listChanged|changedFiles/i, "gate must use shared changed-file helper");
  });

  it("R7: classifier separates spec-local tests, project test paths, full mode, and targeted mode", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    assert.match(src, /specs\/|active.*spec|spec-local/i, "active spec-local tests must be classified specially");
    assert.match(src, /projectPaths|test\.projectPaths/i, "test.projectPaths must drive project test-file classification");
    assert.match(src, /target_paths|targeted/i, "targeted mode and target_paths must exist");
    assert.match(src, /full/i, "full regression mode must exist");
    assert.match(src, /unknown|analysis|execution|config|test-contract/i, "unknown or contract-impacting files must force full mode");
  });

  it("R10: skipped regression categories include mixed non-trigger changes", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    for (const value of ["docs-only", "spec-artifact-only", "non-project-only", "mixed-non-trigger"]) {
      assert.match(src, new RegExp(value), `required=false category ${value} must be supported`);
    }
    assert.match(src, /classified_paths|classifiedPaths/i, "skipped regression must record classified paths");
  });

  it("R11: required regression writes raw start/end markers and line ranges", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    assert.match(src, /start.*marker|BEGIN|START/i, "raw log must include a regression start marker");
    assert.match(src, /end.*marker|END/i, "raw log must include a regression end marker");
    assert.match(src, /start_line|end_line/i, "artifact must record 1-based inclusive line range");
    assert.match(src, /command[\s\S]{0,160}result|result[\s\S]{0,160}command/i, "markers must include command and result values");
  });

  it("R12: started non-zero, signal, 127, and timeout outcomes become fail artifacts", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    for (const pattern of [/exitCode|exit code/i, /127/, /signal/i, /timeout|timedOut/i, /result["']?\s*:\s*["']fail|result.*fail/i]) {
      assert.match(src, pattern, `test-execute must handle ${pattern}`);
    }
  });

  it("R14: test-execute removes stale downstream artifacts at step start", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    for (const name of ["test-execute-result.json", "test-result-review.json", "test-result-review.md", "retro.json", "report.json"]) {
      assert.match(src, new RegExp(name.replace(/[.]/g, "\\.")), `${name} must be deleted or overwritten at step start`);
    }
    assert.match(src, /rm|unlink|delete|cleanup/i, "stale cleanup must be explicit");
  });

  it("R20: prompts and system instructions use R4 discovery and exclude README/Python/commands.test discovery", () => {
    for (const relPath of ["src/flow/prompts/impl/test-execute.md", "src/flow/lib/run-test-execute.js"]) {
      const src = read(relPath);
      assert.match(src, /test\.command|package\.json|composer\.json|Makefile/i, `${relPath} must describe R4 discovery`);
      assert.doesNotMatch(src, /README.*discover|discover.*README|pyproject|pytest.*auto|commands\.test/i, `${relPath} must not use out-of-scope discovery`);
    }
  });

  it("R22: temporary requirement summary artifact lives under spec tests/.raw and is removed", () => {
    const src = read("src/flow/lib/run-test-execute.js");
    assert.match(src, /tests\/\.raw|tests.*\.raw/i, "temporary summary must live under spec tests/.raw");
    assert.match(src, /summary/i, "temporary requirement summary must be handled");
    assert.match(src, /unlink|delete|cleanup/i, "temporary summary must be deleted after composition");
    assertContains("src/flow/lib/run-finalize-commit.js", /exclude|pathspec|raw/i, "finalize commit must exclude temporary summary artifacts");
  });

  it("R23: process execution returns deterministic started/exit/signal/timeout/spawn fields", () => {
    const processSrc = read("src/flow/lib/test-regression.js");
    for (const name of ["started", "exitCode", "signal", "timedOut", "spawnError", "stdout", "stderr"]) {
      assert.match(processSrc, new RegExp(name), `process result must include ${name}`);
    }
    assertContains("src/flow/lib/run-test-execute.js", /started|spawnError|timedOut/i, "test-execute must consume deterministic process result");
  });
});
