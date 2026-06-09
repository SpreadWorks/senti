import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { checkSpecText, checkSpecJson } from "../../../../src/flow/lib/run-gate.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../helpers/tmp-dir.js";
import { execFileSync } from "child_process";
import { setupFlow } from "../../../helpers/flow-setup.js";

function initGateProject(tmp) {
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
  setupFlow(tmp);
  writeJson(tmp, ".senti/config.json", {
    lang: "en", type: "node-cli",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
}

function validSpecJson(overrides = {}) {
  return {
    goal: "test goal",
    background: "test background",
    scope: { in: ["a"], out: ["b"] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{ id: "REQ-1", desc: "placeholder requirement" }],
    acceptance_criteria: ["placeholder acceptance criterion"],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    // spec 226: tasks[] is required to be non-empty for spec gate to pass
    tasks: [
      { id: "T-1", title: "placeholder", goal: "placeholder", origin: "plan", added_round: 0, status: "pending" },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// checkSpecText — markdown checker (used by phase=task-spec for task drafts)
// ---------------------------------------------------------------------------

describe("checkSpecText (task-spec markdown)", () => {
  it("returns no issues for a valid spec", () => {
    const text = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
      "- test passes",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.deepEqual(issues, []);
  });

  it("detects missing Clarifications section", () => {
    const text = [
      "# Spec",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.ok(issues.some((i) => i.includes("Clarifications")));
  });

  it("detects missing Open Questions section", () => {
    const text = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.ok(issues.some((i) => i.includes("Open Questions")));
  });

  it("detects missing User Confirmation section", () => {
    const text = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## Acceptance Criteria",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.ok(issues.some((i) => i.includes("User Confirmation")));
  });

  it("detects missing Acceptance Criteria", () => {
    const text = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.ok(issues.some((i) => i.includes("Acceptance Criteria")));
  });

  it("detects unresolved markers (TBD/TODO/FIXME)", () => {
    const text = [
      "# Spec",
      "- TBD: decide later",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.ok(issues.some((i) => i.includes("unresolved token")));
  });

  it("detects unchecked tasks", () => {
    const text = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "- [ ] Need to clarify",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.ok(issues.some((i) => i.includes("unchecked task")));
  });

  it("accepts User Scenarios & Testing as alternative", () => {
    const text = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## User Scenarios & Testing",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.deepEqual(issues, []);
  });

  it("skips unchecked items in Acceptance Criteria (lenient)", () => {
    const text = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
      "- [ ] feature works",
      "- [ ] tests pass",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.deepEqual(issues, []);
  });

  it("skips unchecked items in Status section", () => {
    const text = [
      "# Spec",
      "## Status",
      "- [x] Spec created",
      "- [ ] Implementation complete",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
      "- [ ] done",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.deepEqual(issues, []);
  });

  it("still detects unchecked items outside skip-listed sections", () => {
    const text = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "- [ ] unresolved question",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
      "- [ ] done",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.ok(issues.some((i) => i.includes("unchecked task")));
  });

  it("ignores unresolved tokens inside table rows", () => {
    const text = [
      "# Spec",
      "| Phase | TODO |",
      "| --- | --- |",
      "| spec | skip TODO items |",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
    ].join("\n");
    const issues = checkSpecText(text);
    assert.deepEqual(issues, []);
  });
});

// ---------------------------------------------------------------------------
// checkSpecJson — JSON checker (used by phase=spec for parent spec.json)
// ---------------------------------------------------------------------------

describe("checkSpecJson (parent spec.json)", () => {
  it("returns no issues for a valid spec.json (R1, R2)", () => {
    const issues = checkSpecJson(validSpecJson());
    assert.deepEqual(issues, []);
  });

  it("returns no issues for a fully populated spec.json", () => {
    const spec = validSpecJson({
      goal: "deliver feature X",
      background: "current behavior is broken because Y",
      scope: { in: ["module A"], out: ["module B"] },
      constraints: ["no external deps"],
      design_principles: ["fail fast"],
      requirements: [{ id: "R1", desc: "When X happens, system shall Y." }],
      acceptance_criteria: ["X test passes"],
      clarifications: [{ q: "what if Z?", a: "do W" }],
      alternatives_considered: [{ option: "approach A", reason: "rejected because slow" }],
      open_questions: [],
      overview: {
        modules: [{ text: "module A handles X" }],
        data_flow: [{ text: "input -> A -> output" }],
        decisions: [{ text: "use sync IO" }],
      },
    });
    const issues = checkSpecJson(spec);
    assert.deepEqual(issues, []);
  });

  it("detects unresolved TBD marker in goal (R3)", () => {
    const spec = validSpecJson({ goal: "TBD" });
    const issues = checkSpecJson(spec);
    assert.ok(
      issues.some((i) => i.includes("goal") && /TBD/.test(i)),
      `expected goal/TBD issue, got: ${JSON.stringify(issues)}`,
    );
  });

  it("detects unresolved TODO marker in background (R3)", () => {
    const spec = validSpecJson({ background: "TODO: write background later" });
    const issues = checkSpecJson(spec);
    assert.ok(
      issues.some((i) => i.includes("background") && /TODO/.test(i)),
      `expected background/TODO issue, got: ${JSON.stringify(issues)}`,
    );
  });

  it("detects unresolved FIXME marker in requirements[].desc (R3)", () => {
    const spec = validSpecJson({
      requirements: [{ id: "R1", desc: "When X, FIXME shall happen" }],
    });
    const issues = checkSpecJson(spec);
    assert.ok(
      issues.some((i) => /requirements\[0\]\.desc/.test(i) && /FIXME/.test(i)),
      `expected requirements[0].desc/FIXME issue, got: ${JSON.stringify(issues)}`,
    );
  });

  it("detects [NEEDS CLARIFICATION] marker in scope.in[] (R3)", () => {
    const spec = validSpecJson({
      scope: { in: ["[NEEDS CLARIFICATION] which module?"], out: [] },
    });
    const issues = checkSpecJson(spec);
    assert.ok(
      issues.some((i) => /scope\.in\[0\]/.test(i) && /NEEDS CLARIFICATION/i.test(i)),
      `expected scope.in[0]/NEEDS CLARIFICATION issue, got: ${JSON.stringify(issues)}`,
    );
  });

  it("detects unresolved markers in clarifications[].q and .a (R3)", () => {
    const spec = validSpecJson({
      clarifications: [{ q: "TBD question", a: "TODO answer" }],
    });
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /clarifications\[0\]\.q/.test(i) && /TBD/.test(i)));
    assert.ok(issues.some((i) => /clarifications\[0\]\.a/.test(i) && /TODO/.test(i)));
  });

  it("detects markers case-insensitively (R3)", () => {
    const spec = validSpecJson({ goal: "tbd" });
    const issues = checkSpecJson(spec);
    assert.ok(
      issues.some((i) => i.includes("goal") && /tbd/i.test(i)),
      `expected case-insensitive marker detection, got: ${JSON.stringify(issues)}`,
    );
  });

  it("does not flag substrings that are part of larger words", () => {
    const spec = validSpecJson({ background: "We will subdivide the work" });
    const issues = checkSpecJson(spec);
    assert.deepEqual(
      issues.filter((i) => /tbd|todo|fixme/i.test(i)),
      [],
    );
  });

  it("walks overview.modules[].text for markers (R3)", () => {
    const spec = validSpecJson({
      overview: {
        modules: [{ text: "TODO describe later" }],
        data_flow: [],
        decisions: [],
      },
    });
    const issues = checkSpecJson(spec);
    assert.ok(
      issues.some((i) => /overview\.modules\[0\]\.text/.test(i) && /TODO/.test(i)),
      `expected overview.modules[0].text issue, got: ${JSON.stringify(issues)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// gate CLI
// ---------------------------------------------------------------------------

describe("gate CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("exits 0 on valid spec (legacy markdown via --spec spec.md)", () => {
    tmp = createTmpDir();
    initGateProject(tmp);
    const specContent = [
      "# Spec",
      "## Clarifications (Q&A)",
      "## Open Questions",
      "## User Confirmation",
      "- [x] User approved this spec",
      "## Acceptance Criteria",
      "- done",
    ].join("\n");
    writeFile(tmp, "spec.md", specContent);

    // For this CLI test we feed a markdown path directly; phase=task-spec is what
    // the markdown checker is meant for. The CLI accepts --spec for any phase.
    const result = execFileSync("node", [
      join(process.cwd(), "src/senti.js"),
      "flow", "run", "gate",
      "--phase", "task-spec",
      "--spec", join(tmp, "spec.md"),
    ], { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
  });

  it("returns ok:true with result:fail when task-spec markdown is empty", () => {
    tmp = createTmpDir();
    initGateProject(tmp);
    writeFile(tmp, "spec.md", "# Empty spec\n");

    const result = execFileSync("node", [
      join(process.cwd(), "src/senti.js"),
      "flow", "run", "gate",
      "--phase", "task-spec",
      "--spec", join(tmp, "spec.md"),
    ], { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.result, "fail");
    assert.ok(envelope.data.artifacts.issues.length > 0);
  });

  it("phase=spec reads spec.json and returns ok:true with PASS-eligible textCheck (R1, R5, R7)", () => {
    tmp = createTmpDir();
    initGateProject(tmp);
    const specDir = join(tmp, "specs", "001-test");
    const validSpec = validSpecJson({
      // T-default matches the seed task in flow.json (monotonic check).
      tasks: [
        { id: "T-default", title: "Default test task", goal: "Placeholder task for test fixtures.", origin: "plan", added_round: 0, status: "pending" },
      ],
    });
    writeJson(tmp, "specs/001-test/spec.json", validSpec);

    // Pass spec.md path; resolveSpecJsonPath should resolve to spec.json (R5).
    const result = execFileSync("node", [
      join(process.cwd(), "src/senti.js"),
      "flow", "run", "gate",
      "--phase", "spec",
      "--spec", join(specDir, "spec.md"),
      "--skip-guardrail",
    ], { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.result, "pass");
  });

  it("phase=spec FAILs when spec.json has unresolved marker in goal (R3, R7)", () => {
    tmp = createTmpDir();
    initGateProject(tmp);
    const specDir = join(tmp, "specs", "002-test");
    const spec = {
      goal: "TBD",
      background: "",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      requirements: [],
      acceptance_criteria: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    };
    writeJson(tmp, "specs/002-test/spec.json", spec);

    let envelope;
    try {
      const result = execFileSync("node", [
        join(process.cwd(), "src/senti.js"),
        "flow", "run", "gate",
        "--phase", "spec",
        "--spec", join(specDir, "spec.json"),
        "--skip-guardrail",
      ], { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } });
      envelope = JSON.parse(result);
    } catch (err) {
      // gate FAIL → exit code 1 (R7). Parse stdout from error.
      envelope = JSON.parse(err.stdout.toString());
    }
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.result, "fail");
    assert.ok(
      envelope.data.artifacts.issues.some((i) => i.includes("goal") && /TBD/.test(i)),
      `expected goal/TBD issue, got: ${JSON.stringify(envelope.data.artifacts.issues)}`,
    );
  });

  it("phase=spec FAILs when spec.json fails schema validation (R2)", () => {
    tmp = createTmpDir();
    initGateProject(tmp);
    const specDir = join(tmp, "specs", "003-test");
    // Missing required field: acceptance_criteria
    const spec = {
      goal: "g",
      background: "",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      requirements: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    };
    writeJson(tmp, "specs/003-test/spec.json", spec);

    let envelope;
    try {
      const result = execFileSync("node", [
        join(process.cwd(), "src/senti.js"),
        "flow", "run", "gate",
        "--phase", "spec",
        "--spec", join(specDir, "spec.json"),
        "--skip-guardrail",
      ], { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } });
      envelope = JSON.parse(result);
    } catch (err) {
      envelope = JSON.parse(err.stdout.toString());
    }
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.result, "fail");
    assert.ok(
      envelope.data.artifacts.issues.some((i) => /schema|acceptance_criteria/i.test(i)),
      `expected schema validation issue, got: ${JSON.stringify(envelope.data.artifacts.issues)}`,
    );
  });
});
