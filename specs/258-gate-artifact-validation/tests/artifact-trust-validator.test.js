// spec: R1 R2 R3 R4 R6
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildGateArtifactTrustContract,
  validateIntegrationArtifactTrust,
} from "../../../src/flow/lib/test-artifacts.js";
import { RunGateCommand } from "../../../src/flow/lib/run-gate.js";
import { container } from "../../../src/lib/container.js";

const SPEC_NAME = "258-gate-artifact-validation";
const SPEC_REL = path.join("specs", SPEC_NAME, "spec.json");
const RAW_REL = path.join("specs", SPEC_NAME, "tests", ".raw", "test-execution.log");
const REQUIRED_TRUST_INPUTS = Object.freeze([
  "test-execute-result.json",
  "test-result-review.json",
  "file-map.json",
  "tests/.raw/test-execution.log",
]);
const PLACEHOLDER_SENTINEL = "placeholder command";

afterEach(() => {
  container.reset();
});

function makeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-artifact-trust-"));
  const specDir = path.join(root, "specs", SPEC_NAME);
  fs.mkdirSync(path.join(specDir, "tests", ".raw"), { recursive: true });
  fs.mkdirSync(path.join(root, "src", "flow", "lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "flow", "lib", "test-artifacts.js"), "export const fixture = true;\n");
  return { root, specDir };
}

function runGit(root, args) {
  execFileSync("git", args, { cwd: root, stdio: "ignore" });
}

function makeGateRoot() {
  const { root, specDir } = makeRoot();
  fs.writeFileSync(path.join(root, "README.md"), "base\n");
  fs.writeFileSync(path.join(root, "src", "flow", "lib", "test-artifacts.js"), "export const base = true;\n");
  runGit(root, ["init", "-b", "main"]);
  runGit(root, ["config", "user.email", "test@example.com"]);
  runGit(root, ["config", "user.name", "Test User"]);
  runGit(root, ["add", "README.md", "src/flow/lib/test-artifacts.js"]);
  runGit(root, ["commit", "-m", "base"]);
  fs.writeFileSync(path.join(root, "src", "flow", "lib", "test-artifacts.js"), "export const changed = true;\n");
  return { root, specDir };
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeMalformedJson(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, "{ invalid json\n");
}

function slash(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function makeSpec(requirementIds = ["R1"]) {
  return {
    goal: "artifact trust validation fixture",
    background: "Fixture spec used by artifact trust validation tests.",
    scope: {
      in: ["Validate integration artifact trust fixtures."],
      out: ["Exercise unrelated flow behavior."],
    },
    constraints: ["Fixture artifacts must be deterministic."],
    design_principles: ["Keep test fixtures small and explicit."],
    overview: {
      modules: [{ text: "Artifact trust validator checks required test artifacts." }],
      data_flow: [{ text: "Fixtures write spec artifacts before validation." }],
      decisions: [{ text: "Tests use deterministic local files and git roots." }],
    },
    requirements: requirementIds.map((id) => ({
      id,
      desc: `${id} artifact trust requirement`,
      priority: "must",
    })),
    acceptance_criteria: ["Artifact trust fixtures are valid."],
    clarifications: [],
    alternatives_considered: [
      { option: "Use shared repository state", reason: "Rejected because isolated temp roots avoid cross-test coupling." },
    ],
    open_questions: [],
    tasks: [
      {
        id: "T-1",
        title: "Fixture task",
        goal: "Build isolated artifact trust fixtures.",
        origin: "plan",
        added_round: 0,
        status: "pending",
        parent: null,
      },
    ],
  };
}

function makeSummaryEntry(root, specDir, id = "R1", overrides = {}) {
  const testFile = path.join(specDir, "tests", "artifact-behavior.test.js");
  const testName = `${id}: validates artifact trust`;
  return {
    id,
    result: "pass",
    evidence: {
      command: "node --test specs/258-gate-artifact-validation/tests/artifact-behavior.test.js",
      test_file: slash(path.relative(root, testFile)),
      test_name: testName,
      raw_output_lines: { start_line: 1, end_line: 2 },
      ...overrides.evidence,
    },
    ...overrides.entry,
  };
}

function makeReview(overrides = {}) {
  return {
    verdict: "pass",
    checked_items: [
      { check: "project_regression_verification", result: "pass", detail: "project regression evidence is valid" },
    ],
    result_file_path: "specs/258-gate-artifact-validation/test-execute-result.json",
    raw_output_path: "specs/258-gate-artifact-validation/tests/.raw/test-execution.log",
    ...overrides,
  };
}

function makeFileMap(requirementIds = ["R1"], paths = ["src/flow/lib/test-artifacts.js"]) {
  return Object.fromEntries(requirementIds.map((id) => [id, [...paths]]));
}

function writeTestFile(specDir, requirementIds = ["R1"]) {
  const testFile = path.join(specDir, "tests", "artifact-behavior.test.js");
  const body = [
    "import { test } from 'node:test';",
    ...requirementIds.map((id) => `test('${id}: validates artifact trust', () => {});`),
    "",
  ].join("\n");
  fs.writeFileSync(testFile, body);
  return testFile;
}

function writeRawLog(specDir, requirementIds = ["R1"], extraLines = []) {
  const lines = [
    "TAP version 13",
    ...requirementIds.map((id, index) => `ok ${index + 1} - ${id}: validates artifact trust`),
    "[sdd-forge] project regression skipped category=non-project-only",
    ...extraLines,
  ];
  fs.writeFileSync(path.join(specDir, "tests", ".raw", "test-execution.log"), lines.join("\n"));
  return lines;
}

function writeValidArtifacts(root, specDir, overrides = {}) {
  const requirementIds = overrides.requirementIds || ["R1"];
  const spec = overrides.spec || makeSpec(requirementIds);
  writeJson(path.join(specDir, "spec.json"), spec);
  writeTestFile(specDir, requirementIds);
  writeRawLog(specDir, requirementIds, overrides.rawExtraLines || []);

  const result = {
    version: "2",
    raw_output_path: slash(RAW_REL),
    summary: requirementIds.map((id, index) => makeSummaryEntry(root, specDir, id, {
      evidence: { raw_output_lines: { start_line: index + 2, end_line: index + 2 } },
    })),
    regression: {
      required: false,
      changed_files: [],
      trigger_relevant_changed_files: [],
      category: "non-project-only",
      reason: "spec-local artifact fixture",
      classified_paths: [],
    },
    ...overrides.result,
  };
  writeJson(path.join(specDir, "test-execute-result.json"), result);
  writeJson(path.join(specDir, "test-result-review.json"), makeReview(overrides.review));
  writeJson(path.join(specDir, "file-map.json"), overrides.fileMap || makeFileMap(requirementIds));
}

function validate(root, specDir, options = {}) {
  return validateIntegrationArtifactTrust({
    root,
    specDir,
    phase: options.phase || "integration",
    specPath: SPEC_REL,
    state: options.state || { spec: SPEC_REL, baseBranch: "main" },
    config: options.config || {},
  });
}

function assertArtifactPlaceholder(result) {
  assert.equal(result.ok, false);
  assert.equal(result.code, "ARTIFACT_PLACEHOLDER");
}

function assertGateArtifactPlaceholder(result) {
  assert.equal(result.ok, false);
  assert.equal(result.errors?.[0]?.code, "ARTIFACT_PLACEHOLDER");
}

function writePermission(specDir, overrides = {}) {
  writeJson(path.join(specDir, "placeholder-permission.json"), {
    version: 1,
    phase: "integration",
    approvedByUser: true,
    artifactPaths: ["test-execute-result.json"],
    permissionText: "User explicitly permitted placeholder artifact for unavailable execution.",
    reason: "real execution unavailable in this environment",
    createdAt: "2026-05-17T00:00:00.000Z",
    ...overrides,
  });
}

function withPlaceholderCommand(root, specDir) {
  writeValidArtifacts(root, specDir, {
    result: {
      summary: [
        makeSummaryEntry(root, specDir, "R1", {
          evidence: { command: PLACEHOLDER_SENTINEL },
        }),
      ],
    },
  });
}

async function runGateWithStubbedAgent(root, { phase = "integration" } = {}) {
  let calls = 0;
  container.set("agent", {
    resolve(commandId) {
      return commandId === "flow.spec.gate";
    },
    async call() {
      calls += 1;
      return JSON.stringify({
        evaluations: [
          { guardrail_id: "R1", result: "pass", reason: "requirement satisfied by fixture diff" },
        ],
      });
    },
  });
  const command = new RunGateCommand();
  const result = await command.execute({
    root,
    config: {},
    flowState: {
      spec: SPEC_REL,
      baseBranch: "main",
      metrics: [],
    },
    phase,
    skipGuardrail: true,
  });
  return { result, calls };
}

function writePlaceholderHashFixture(root, specDir) {
  writeTestFile(specDir, ["R1"]);
  writeRawLog(specDir, ["R1"]);
  fs.writeFileSync(
    path.join(specDir, "test-execute-result.json"),
    [
      "{",
      '  "version": "2",',
      '  "raw_output_path": "specs/258-gate-artifact-validation/tests/.raw/test-execution.log",',
      '  "summary": [',
      "    {",
      '      "id": "R1",',
      '      "result": "pass",',
      '      "evidence": {',
      '        "command": "node --test specs/258-gate-artifact-validation/tests/artifact-behavior.test.js",',
      '        "test_file": "specs/258-gate-artifact-validation/tests/artifact-behavior.test.js",',
      '        "test_name": "R1: validates artifact trust",',
      '        "raw_output_lines": {',
      '          "start_line": 1,',
      '          "end_line": 2',
      "        }",
      "      }",
      "    }",
      "  ],",
      '  "regression": {',
      '    "required": false,',
      '    "changed_files": [],',
      '    "trigger_relevant_changed_files": [],',
      '    "category": "non-project-only",',
      '    "reason": "documented placeholder hash fixture",',
      '    "classified_paths": []',
      "  }",
      "}",
      "",
    ].join("\n"),
  );
  writeJson(path.join(specDir, "spec.json"), makeSpec(["R1"]));
  writeJson(path.join(specDir, "test-result-review.json"), makeReview());
  writeJson(path.join(specDir, "file-map.json"), makeFileMap(["R1"]));
}

describe("artifact trust contract", () => {
  it("R1: lists exactly the required flow-level gate-impl integration trust inputs", () => {
    const contract = buildGateArtifactTrustContract({ step: "gate-impl", phase: "integration" });

    assert.deepEqual(contract.requiredTrustInputs, REQUIRED_TRUST_INPUTS);
    assert.equal(contract.requiredTrustInputs.includes("retro.json"), false);
    assert.equal(contract.requiredTrustInputs.includes("report.json"), false);
  });

  it("R1: excludes task-level gate-impl from integration artifact trust inputs", () => {
    const contract = buildGateArtifactTrustContract({ step: "gate-impl", phase: "task-impl" });

    assert.deepEqual(contract.requiredTrustInputs, []);
  });
});

describe("artifact trust validation", () => {
  it("R1: accepts valid integration trust inputs when retro and report artifacts are absent", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir);

    const result = validate(root, specDir);

    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(path.join(specDir, "retro.json")), false);
    assert.equal(fs.existsSync(path.join(specDir, "report.json")), false);
  });

  it("R1: accepts valid integration trust inputs and ignores downstream summaries", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir);
    writeJson(path.join(specDir, "retro.json"), { placeholder: true });
    writeJson(path.join(specDir, "report.json"), { placeholder: true });

    const result = validate(root, specDir);

    assert.equal(result.ok, true);
  });

  for (const artifact of REQUIRED_TRUST_INPUTS) {
    it(`R2: rejects missing required trust input ${artifact} with ARTIFACT_PLACEHOLDER`, () => {
      const { root, specDir } = makeRoot();
      writeValidArtifacts(root, specDir);
      fs.rmSync(path.join(specDir, artifact));

      const result = validate(root, specDir);

      assertArtifactPlaceholder(result);
      const artifactName = path.basename(artifact);
      assert.match(result.reason, new RegExp(artifactName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });
  }

  for (const artifact of [
    "test-execute-result.json",
    "test-result-review.json",
    "file-map.json",
  ]) {
    it(`R2: rejects malformed JSON in ${artifact}`, () => {
      const { root, specDir } = makeRoot();
      writeValidArtifacts(root, specDir);
      writeMalformedJson(path.join(specDir, artifact));

      const result = validate(root, specDir);

      assertArtifactPlaceholder(result);
      assert.match(result.reason, /JSON|parse|malformed/i);
    });
  }

  const missingKeyCases = [
    {
      name: "test-execute-result.json version",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        delete result.version;
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
      reason: /version/,
    },
    {
      name: "test-execute-result.json summary",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        delete result.summary;
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
      reason: /summary/,
    },
    {
      name: "test-execute-result.json summary[].evidence",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        delete result.summary[0].evidence;
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
      reason: /evidence/,
    },
    {
      name: "test-execute-result.json summary[].evidence.raw_output_lines",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        delete result.summary[0].evidence.raw_output_lines;
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
      reason: /raw_output_lines/,
    },
    {
      name: "test-result-review.json verdict",
      mutate(root, specDir) {
        const review = readJson(path.join(specDir, "test-result-review.json"));
        delete review.verdict;
        writeJson(path.join(specDir, "test-result-review.json"), review);
      },
      reason: /verdict/,
    },
    {
      name: "test-result-review.json checked_items",
      mutate(root, specDir) {
        const review = readJson(path.join(specDir, "test-result-review.json"));
        delete review.checked_items;
        writeJson(path.join(specDir, "test-result-review.json"), review);
      },
      reason: /checked_items/,
    },
    {
      name: "file-map.json entries",
      mutate(root, specDir) {
        writeJson(path.join(specDir, "file-map.json"), {});
      },
      reason: /file-map|R1|missing/i,
    },
  ];

  for (const tc of missingKeyCases) {
    it(`R2: rejects missing required key: ${tc.name}`, () => {
      const { root, specDir } = makeRoot();
      writeValidArtifacts(root, specDir);
      tc.mutate(root, specDir);

      const result = validate(root, specDir);

      assertArtifactPlaceholder(result);
      assert.match(result.reason, tc.reason);
    });
  }

  it("R2: rejects an empty requirement summary for a testable requirement set", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, { result: { summary: [] } });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /summary|missing|R1/i);
  });

  it("R2: rejects whitespace-only requirement ids in the execution summary", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      result: {
        summary: [
          makeSummaryEntry(root, specDir, "R1", {
            entry: { id: "   " },
          }),
        ],
      },
    });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /summary|requirement|id/i);
  });

  it("R2: rejects unknown requirement ids in test-execute-result.json", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      result: {
        summary: [
          makeSummaryEntry(root, specDir, "R1", {
            entry: { id: "R999" },
          }),
        ],
      },
    });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /unknown|R999/);
  });

  it("R2 R6: rejects unknown requirement ids in file-map.json", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      fileMap: {
        R1: ["src/flow/lib/test-artifacts.js"],
        R999: ["src/flow/lib/run-gate.js"],
      },
    });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /file-map|unknown|R999/i);
  });

  it("R2: rejects file-map.json paths that do not exist", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      fileMap: {
        R1: ["src/flow/lib/missing-artifact-map-entry.js"],
      },
    });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /file-map|missing path/i);
  });

  it("R2: rejects raw output line references outside the execution log", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      result: {
        summary: [
          makeSummaryEntry(root, specDir, "R1", {
            evidence: { raw_output_lines: { start_line: 1, end_line: 99 } },
          }),
        ],
      },
    });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /raw.*outside|line/i);
  });

  it("R2: rejects raw output evidence ranges that do not contain the expected test evidence", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      result: {
        summary: [
          makeSummaryEntry(root, specDir, "R1", {
            evidence: { raw_output_lines: { start_line: 1, end_line: 1 } },
          }),
        ],
      },
    });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /raw|evidence|R1/i);
  });

  const sentinelCases = [
    {
      name: "summary[].evidence.command",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        result.summary[0].evidence.command = PLACEHOLDER_SENTINEL;
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
    },
    {
      name: "summary[].evidence.test_name",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        result.summary[0].evidence.test_name = "placeholder test name";
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
    },
    {
      name: "summary[].evidence.test_file",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        result.summary[0].evidence.test_file = "specs/258-gate-artifact-validation/tests/placeholder.test.js";
        fs.writeFileSync(
          path.join(specDir, "tests", "placeholder.test.js"),
          "import { test } from 'node:test';\ntest('R1: validates artifact trust', () => {});\n",
        );
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
    },
    {
      name: "regression.command",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        result.regression = {
          required: true,
          mode: "full",
          root_test_command: "npm test --",
          root_test_command_source: "package.json:scripts.test",
          command: PLACEHOLDER_SENTINEL,
          result: "pass",
          raw_output_lines: { start_line: 3, end_line: 3 },
          changed_files: [],
          trigger_relevant_changed_files: [],
          process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
        };
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
    },
    {
      name: "regression.root_test_command",
      mutate(root, specDir) {
        const result = readJson(path.join(specDir, "test-execute-result.json"));
        result.regression = {
          required: true,
          mode: "full",
          root_test_command: PLACEHOLDER_SENTINEL,
          root_test_command_source: "package.json:scripts.test",
          command: "npm test --",
          result: "pass",
          raw_output_lines: { start_line: 3, end_line: 3 },
          changed_files: [],
          trigger_relevant_changed_files: [],
          process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
        };
        writeJson(path.join(specDir, "test-execute-result.json"), result);
      },
    },
    {
      name: "test-result-review.json checked_items[].detail",
      mutate(root, specDir) {
        const review = readJson(path.join(specDir, "test-result-review.json"));
        review.checked_items[0].detail = "placeholder review detail";
        writeJson(path.join(specDir, "test-result-review.json"), review);
      },
    },
  ];

  for (const tc of sentinelCases) {
    it(`R3: rejects configured placeholder sentinel in ${tc.name}`, () => {
      const { root, specDir } = makeRoot();
      writeValidArtifacts(root, specDir);
      tc.mutate(root, specDir);

      const result = validate(root, specDir);

      assertArtifactPlaceholder(result);
      assert.match(result.reason, /placeholder/i);
    });
  }

  it("R3: rejects configured placeholder sentinel strings literally", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      result: {
        summary: [
          makeSummaryEntry(root, specDir, "R1", {
            evidence: { command: "node --test generated::<fake-artifact>" },
          }),
        ],
      },
    });

    const result = validate(root, specDir, {
      config: { placeholderSentinels: ["generated::<fake-artifact>"] },
    });

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /placeholder|sentinel/i);
  });

  it("R3: rejects JSON artifacts whose content hashes to a documented placeholder fixture hash", () => {
    const { root, specDir } = makeRoot();
    writePlaceholderHashFixture(root, specDir);

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /hash|placeholder/i);
  });

  it("R3: does not globally sentinel-scan file-map path values", () => {
    const { root, specDir } = makeRoot();
    fs.mkdirSync(path.join(root, "src", "placeholder-path"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "placeholder-path", "test-artifacts.js"), "export const fixture = true;\n");
    writeValidArtifacts(root, specDir, {
      fileMap: {
        R1: ["src/placeholder-path/test-artifacts.js"],
      },
    });

    const result = validate(root, specDir);

    assert.equal(result.ok, true);
  });

  it("R3: does not globally sentinel-scan unreferenced raw execution log text", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      rawExtraLines: ["placeholder text emitted by an unrelated skipped test"],
    });

    const result = validate(root, specDir);

    assert.equal(result.ok, true);
  });

  it("R3: caps summary sentinel scanning at 200 entries", () => {
    const { root, specDir } = makeRoot();
    const requirementIds = Array.from({ length: 201 }, (_, index) => `R${index + 1}`);
    writeValidArtifacts(root, specDir, { requirementIds });
    const resultArtifact = readJson(path.join(specDir, "test-execute-result.json"));
    resultArtifact.summary[200].evidence.command = PLACEHOLDER_SENTINEL;
    writeJson(path.join(specDir, "test-execute-result.json"), resultArtifact);

    const result = validate(root, specDir);

    assert.equal(result.ok, true);
  });

  it("R3: caps review checked item sentinel scanning at 200 entries", () => {
    const { root, specDir } = makeRoot();
    const checkedItems = [
      { check: "project_regression_verification", result: "pass", detail: "project regression evidence is valid" },
      ...Array.from({ length: 199 }, (_, index) => ({
        check: `auxiliary_${index}`,
        result: "pass",
        detail: `auxiliary evidence ${index}`,
      })),
      { check: "late_placeholder", result: "pass", detail: "placeholder review detail" },
    ];
    writeValidArtifacts(root, specDir, {
      review: { checked_items: checkedItems },
    });

    const result = validate(root, specDir);

    assert.equal(result.ok, true);
  });

  it("R3: caps JSON artifact sentinel scanning at 1 MiB per artifact", () => {
    const { root, specDir } = makeRoot();
    const largeDetail = `${"x".repeat(1024 * 1024 + 1)} placeholder review detail`;
    writeValidArtifacts(root, specDir, {
      review: {
        checked_items: [
          { check: "project_regression_verification", result: "pass", detail: largeDetail },
        ],
      },
    });

    const result = validate(root, specDir);

    assert.equal(result.ok, true);
  });

  it("R4: preserves existing v2 artifact version validation failures", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      result: { version: "1" },
    });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /version/);
  });

  it("R4: preserves test-result-review verdict pass validation", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir, {
      review: {
        verdict: "fail",
        invalid_reason: "review found fabricated evidence",
      },
    });

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /verdict|pass/i);
  });

  it("R4: preserves spec-local test evidence scope validation", () => {
    const { root, specDir } = makeRoot();
    writeValidArtifacts(root, specDir);
    const outsideTest = path.join(root, "tests", "outside.test.js");
    fs.mkdirSync(path.dirname(outsideTest), { recursive: true });
    fs.writeFileSync(outsideTest, "import { test } from 'node:test';\ntest('R1: validates artifact trust', () => {});\n");
    const resultArtifact = readJson(path.join(specDir, "test-execute-result.json"));
    resultArtifact.summary[0].evidence.test_file = "tests/outside.test.js";
    writeJson(path.join(specDir, "test-execute-result.json"), resultArtifact);

    const result = validate(root, specDir);

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /spec-local|tests\/outside|test_file/i);
  });

  it("R4: preserves stale regression snapshot validation", () => {
    const { root, specDir } = makeGateRoot();
    writeValidArtifacts(root, specDir, {
      result: {
        regression: {
          required: true,
          mode: "full",
          root_test_command: "npm test --",
          root_test_command_source: "package.json:scripts.test",
          command: "npm test --",
          result: "pass",
          raw_output_lines: { start_line: 3, end_line: 4 },
          changed_files: [{ status: "modified", path: "stale.js" }],
          trigger_relevant_changed_files: [{ status: "modified", path: "stale.js" }],
          process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
        },
      },
    });
    fs.writeFileSync(path.join(specDir, "tests", ".raw", "test-execution.log"), [
      "TAP version 13",
      "ok 1 - R1: validates artifact trust",
      "[sdd-forge] project regression start command=npm test -- mode=full",
      "[sdd-forge] project regression end result=pass",
    ].join("\n"));
    fs.mkdirSync(path.join(root, ".sdd-forge", "output"), { recursive: true });
    writeJson(path.join(root, ".sdd-forge", "output", "analysis.json"), {});

    const result = validate(root, specDir, {
      state: { spec: SPEC_REL, baseBranch: "main" },
    });

    assertArtifactPlaceholder(result);
    assert.match(result.reason, /stale|changed_files|regression/i);
  });

  it("R6: accepts a placeholder only when the deterministic permission artifact covers it", () => {
    const { root, specDir } = makeRoot();
    withPlaceholderCommand(root, specDir);
    writePermission(specDir);

    const result = validate(root, specDir);

    assert.equal(result.ok, true);
  });

  const invalidPermissionCases = [
    {
      name: "missing permission file",
      write(root, specDir) {},
    },
    {
      name: "malformed permission JSON",
      write(root, specDir) {
        writeMalformedJson(path.join(specDir, "placeholder-permission.json"));
      },
    },
    {
      name: "wrong version",
      write(root, specDir) {
        writePermission(specDir, { version: 2 });
      },
    },
    {
      name: "wrong phase",
      write(root, specDir) {
        writePermission(specDir, { phase: "task-impl" });
      },
    },
    {
      name: "approvedByUser false",
      write(root, specDir) {
        writePermission(specDir, { approvedByUser: false });
      },
    },
    {
      name: "missing artifact path",
      write(root, specDir) {
        writePermission(specDir, { artifactPaths: ["test-result-review.json"] });
      },
    },
    {
      name: "empty permissionText",
      write(root, specDir) {
        writePermission(specDir, { permissionText: "   " });
      },
    },
    {
      name: "empty reason",
      write(root, specDir) {
        writePermission(specDir, { reason: "" });
      },
    },
    {
      name: "empty createdAt",
      write(root, specDir) {
        writePermission(specDir, { createdAt: " " });
      },
    },
  ];

  for (const tc of invalidPermissionCases) {
    it(`R6: rejects placeholder permission when ${tc.name}`, () => {
      const { root, specDir } = makeRoot();
      withPlaceholderCommand(root, specDir);
      tc.write(root, specDir);

      const result = validate(root, specDir);

      assertArtifactPlaceholder(result);
      assert.match(result.reason, /permission|placeholder/i);
    });
  }

  it("R6: keeps required scenario coverage in spec tests with a spec header", () => {
    const testPath = fileURLToPath(import.meta.url);
    const source = fs.readFileSync(testPath, "utf8");

    assert.match(source.split("\n")[0], /^\/\/ spec: .*R1.*R2.*R3.*R4.*R6/);
    assert.match(source, /accepts valid integration trust inputs/);
    assert.match(source, /rejects missing required trust input/);
    assert.match(source, /rejects malformed JSON required artifacts/);
    assert.match(source, /rejects configured placeholder sentinel/);
    assert.match(source, /rejects unknown requirement ids in file-map\.json/);
    assert.match(source, /accepts a placeholder only when the deterministic permission artifact covers it/);
  });
});

describe("flow-level gate artifact precondition", () => {
  it("R1 R2: valid integration artifacts proceed to the AI evaluator", async () => {
    const { root, specDir } = makeGateRoot();
    writeValidArtifacts(root, specDir);

    const { result, calls } = await runGateWithStubbedAgent(root);

    assert.equal(result.result, "pass");
    assert.equal(calls, 1);
  });

  for (const artifact of REQUIRED_TRUST_INPUTS) {
    it(`R2: missing integration artifact ${artifact} fails before the AI evaluator`, async () => {
      const { root, specDir } = makeGateRoot();
      writeValidArtifacts(root, specDir);
      fs.rmSync(path.join(specDir, artifact));

      const { result, calls } = await runGateWithStubbedAgent(root);

      assertGateArtifactPlaceholder(result);
      assert.equal(calls, 0);
    });
  }

  for (const artifact of [
    "test-execute-result.json",
    "test-result-review.json",
    "file-map.json",
  ]) {
    it(`R2: malformed integration JSON ${artifact} fails before the AI evaluator`, async () => {
      const { root, specDir } = makeGateRoot();
      writeValidArtifacts(root, specDir);
      writeMalformedJson(path.join(specDir, artifact));

      const { result, calls } = await runGateWithStubbedAgent(root);

      assertGateArtifactPlaceholder(result);
      assert.equal(calls, 0);
    });
  }

  it("R1: task-level gate-impl does not require flow-level integration trust inputs", async () => {
    const { root, specDir } = makeGateRoot();
    writeValidArtifacts(root, specDir);
    for (const artifact of REQUIRED_TRUST_INPUTS) {
      fs.rmSync(path.join(specDir, artifact), { force: true });
    }

    const { result, calls } = await runGateWithStubbedAgent(root, { phase: "task-impl" });

    assert.equal(result.result, "pass");
    assert.equal(calls, 1);
  });
});
