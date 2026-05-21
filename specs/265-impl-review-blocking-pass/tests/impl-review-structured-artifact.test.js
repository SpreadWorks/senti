// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14 R15 R16 R17
// review-test coverage artifacts report spec-local files relative to this spec directory.
// `tests/impl-review-structured-artifact.test.js` means this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as reviewCommand from "../../../src/flow/commands/review.js";
import * as runReview from "../../../src/flow/lib/run-review.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findFirstPendingLeaf, findStepById } from "../../../src/flow/definition.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const SPEC_ID = "265-impl-review-blocking-pass";
const SPEC_REL = `specs/${SPEC_ID}/spec.json`;
const BLOCKING_MODES = [
  "missing_acceptance_requirement",
  "spec_behavior_contradiction",
  "security_or_data_integrity_bug",
];
const {
  buildImplReviewPrompt,
  filterImplReviewFindingsByScope,
  formatImplReviewJson,
  formatImplReviewMd,
  loadPreviousImplReviewMemory,
  parseImplReviewFindings,
  runImplReview,
} = reviewCommand;
const {
  parseImplReviewOutput,
  updateReviewRetryCounter,
} = runReview;

function collectSharedImplReviewTestCoverage(root) {
  const files = [
    "tests/unit/flow/commands/review.test.js",
    "tests/unit/flow/run-review-advisory.test.js",
  ];
  const contracts = new Set();
  for (const file of files) {
    const text = fs.readFileSync(path.join(root, file), "utf8");
    if (/parseImplReviewFindings/.test(text)) contracts.add("json-parsing");
    if (/filterImplReviewFindingsByScope/.test(text)) contracts.add("scope-filtering");
    if (/formatImplReviewMd/.test(text)) contracts.add("review-md-rendering");
    if (/formatImplReviewJson/.test(text)) contracts.add("impl-review-json-rendering");
    if (/updateReviewRetryCounter[\s\S]*ADVISORY|ADVISORY[\s\S]*updateReviewRetryCounter/.test(text)) contracts.add("advisory-retry");
    if (/FLOW_COMMANDS\.run\.review\.post|parseImplReviewOutput/.test(text)) contracts.add("phase-transitions");
  }
  return { files, contracts: Array.from(contracts) };
}

function appendMetricsFor(result) {
  const metrics = [];
  updateReviewRetryCounter(
    {
      phase: null,
      flowState: {},
      flowManager: {
        appendMetric(payload, opts) {
          metrics.push({ payload, opts });
        },
      },
    },
    result,
  );
  return metrics;
}

test("R1: parser accepts structured blocking and non-blocking impl review JSON only", () => {
  const parsed = parseImplReviewFindings(JSON.stringify({
    blockingFindings: [{
      title: "Missing CLI behavior",
      failureMode: "missing_acceptance_requirement",
      requirementId: "R6",
      issue: "The review result still fails when only non-blocking improvements exist.",
      suggestion: "Base the verdict on blockingFindings.length.",
      rationale: "R6 cannot pass while non-blocking improvements fail the review.",
    }],
    nonBlockingImprovements: [{
      title: "Tighten branch name",
      failureMode: "naming",
      file: "src/flow/lib/run-review.js",
      issue: "A branch name is slightly vague.",
      suggestion: "Rename the branch to advisoryOnly.",
      rationale: "This is readability-only and does not block spec behavior.",
    }],
  }));

  assert.equal(parsed.blockingFindings.length, 1);
  assert.equal(parsed.nonBlockingImprovements.length, 1);
  assert.equal(parsed.blockingFindings[0].requirementId, "R6");
  assert.throws(
    () => parseImplReviewFindings("### 1. Legacy proposal\n**File:** src/x.js"),
    /impl review output failed schema validation|Unexpected token|JSON/i,
  );
  assert.throws(() => parseImplReviewFindings(JSON.stringify({
    blockingFindings: [{
      title: "Missing rationale",
      failureMode: "missing_acceptance_requirement",
      requirementId: "R1",
      issue: "The rationale field is absent.",
      suggestion: "Require rationale.",
    }],
    nonBlockingImprovements: [],
  })), /rationale|schema validation/i);
});

test("R2: prompt and parser limit blocking failure modes to the approved three labels", () => {
  const prompt = buildImplReviewPrompt({
    requirementFileMap: { R1: ["src/flow/commands/review.js"] },
    diff: "diff --git a/src/flow/commands/review.js b/src/flow/commands/review.js",
    touchedFiles: ["src/flow/commands/review.js"],
  });
  const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`;

  for (const mode of BLOCKING_MODES) {
    assert.match(combined, new RegExp(mode));
  }
  assert.deepEqual(parseImplReviewFindings(JSON.stringify({
    blockingFindings: BLOCKING_MODES.map((failureMode, index) => ({
      title: `Blocking ${index}`,
      failureMode,
      file: "src/flow/commands/review.js",
      issue: "Observable issue.",
      suggestion: "Apply the required fix.",
      rationale: "This maps to an approved blocking mode.",
    })),
    nonBlockingImprovements: [],
  })).blockingFindings.map((item) => item.failureMode), BLOCKING_MODES);
  assert.throws(() => parseImplReviewFindings(JSON.stringify({
    blockingFindings: [{
      title: "Style",
      failureMode: "refactor",
      file: "src/flow/commands/review.js",
      issue: "Could be cleaner.",
      suggestion: "Refactor it.",
      rationale: "Preference.",
    }],
    nonBlockingImprovements: [],
  })), /invalid blocking failureMode|schema validation/i);
});

test("R3: excluded impl concerns are advisory or out of scope, never blocking", () => {
  const prompt = buildImplReviewPrompt({
    requirementFileMap: { R1: ["src/flow/commands/review.js"] },
    diff: "diff",
    touchedFiles: ["src/flow/commands/review.js"],
  });
  const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`;
  for (const concern of [
    "regression failures",
    "test false positives",
    "scope creep",
    "project-rule violations",
    "naming",
    "refactor",
    "DRY",
    "comment",
    "docs",
  ]) {
    assert.match(combined, new RegExp(concern, "i"));
  }
  assert.throws(() => parseImplReviewFindings(JSON.stringify({
    blockingFindings: [{
      title: "Refactor preference",
      failureMode: "refactor",
      file: "src/flow/commands/review.js",
      issue: "The helper could be shorter.",
      suggestion: "Extract a helper.",
      rationale: "This is a refactor proposal, not an approved blocker.",
    }],
    nonBlockingImprovements: [],
  })), /invalid blocking failureMode|schema validation/i);
});

test("R4: impl-review.json stores verdict, summary, buckets, and excluded scope counts", () => {
  const json = JSON.parse(formatImplReviewJson({
    blockingFindings: [],
    nonBlockingImprovements: [{
      title: "Optional branch wording",
      failureMode: "naming",
      file: "src/flow/lib/run-review.js",
      issue: "The branch name could be clearer.",
      suggestion: "Rename it.",
      rationale: "Pure readability.",
    }],
    excluded: { missingFile: 1, outOfScope: 2 },
  }));

  assert.equal(json.version, 1);
  assert.equal(json.phase, "impl");
  assert.equal(json.verdict, "ADVISORY");
  assert.equal(typeof json.generatedAt, "string");
  assert.deepEqual(json.summary, { blocking: 0, nonBlocking: 1, total: 1 });
  assert.equal(json.blockingFindings.length, 0);
  assert.equal(json.nonBlockingImprovements.length, 1);
  assert.deepEqual(json.excluded, { missingFile: 1, outOfScope: 2 });
});

test("R4: impl review command path writes impl-review.json to the current spec directory", async () => {
  const tmp = createTmpDir("impl-review-command-r4-");
  try {
    fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), JSON.stringify({
      requirements: [{ id: "R4", desc: "write impl-review.json" }],
    }));

    const result = await runImplReview({
      root: tmp,
      flow: { spec: "specs/demo/spec.json" },
      reviewOutput: JSON.stringify({
        blockingFindings: [],
        nonBlockingImprovements: [{
          title: "Optional naming",
          failureMode: "naming",
          file: "src/flow/commands/review.js",
          issue: "A local name could be clearer.",
          suggestion: "Rename the local.",
          rationale: "Readability-only.",
        }],
      }),
      touchedFiles: new Set(["src/flow/commands/review.js"]),
    });

    const artifactPath = path.join(tmp, "specs/demo/impl-review.json");
    assert.equal(result.artifacts.verdict, "ADVISORY");
    assert.equal(fs.existsSync(artifactPath), true);
    assert.equal(JSON.parse(fs.readFileSync(artifactPath, "utf8")).verdict, "ADVISORY");
  } finally {
    removeTmpDir(tmp);
  }
});

test("R5: review.md renders blocking and non-blocking buckets separately including empty states", () => {
  const md = formatImplReviewMd({
    verdict: "PASS",
    blockingFindings: [],
    nonBlockingImprovements: [],
    excluded: { missingFile: 0, outOfScope: 0 },
  });

  assert.match(md, /## Verdict: PASS/);
  assert.match(md, /## Blocking Findings/);
  assert.match(md, /No blocking findings/);
  assert.match(md, /## Non-blocking Improvements/);
  assert.match(md, /No non-blocking improvements/);

  const populated = formatImplReviewMd({
    verdict: "FAIL",
    blockingFindings: [{
      title: "Missing artifact",
      failureMode: "missing_acceptance_requirement",
      requirementId: "R4",
      issue: "impl-review.json is missing.",
      suggestion: "Write the artifact.",
      rationale: "R4 requires the artifact.",
    }],
    nonBlockingImprovements: [{
      title: "Optional name",
      failureMode: "naming",
      file: "src/flow/lib/run-review.js",
      issue: "The variable name could be clearer.",
      suggestion: "Rename it.",
      rationale: "Readability-only.",
    }],
    excluded: { missingFile: 0, outOfScope: 0 },
  });
  assert.match(populated, /Missing artifact/);
  assert.match(populated, /Optional name/);
  assert.match(populated, /missing_acceptance_requirement/);
  assert.match(populated, /src\/flow\/lib\/run-review\.js/);
});

test("R5: impl review command path writes review.md with both populated buckets", async () => {
  const tmp = createTmpDir("impl-review-command-r5-");
  try {
    fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), JSON.stringify({
      requirements: [{ id: "R5", desc: "write review.md" }],
    }));

    await runImplReview({
      root: tmp,
      flow: { spec: "specs/demo/spec.json" },
      reviewOutput: JSON.stringify({
        blockingFindings: [{
          title: "Missing behavior",
          failureMode: "missing_acceptance_requirement",
          requirementId: "R5",
          issue: "The review summary is missing.",
          suggestion: "Write review.md.",
          rationale: "The requirement needs a human-readable artifact.",
        }],
        nonBlockingImprovements: [{
          title: "Optional prompt wording",
          failureMode: "docs",
          file: "src/flow/prompts/impl/review.md",
          issue: "One sentence could be clearer.",
          suggestion: "Clarify the sentence.",
          rationale: "Non-blocking prompt polish.",
        }],
      }),
      touchedFiles: new Set(["src/flow/prompts/impl/review.md"]),
    });

    const reviewMd = fs.readFileSync(path.join(tmp, "specs/demo/review.md"), "utf8");
    assert.match(reviewMd, /## Blocking Findings/);
    assert.match(reviewMd, /Missing behavior/);
    assert.match(reviewMd, /## Non-blocking Improvements/);
    assert.match(reviewMd, /Optional prompt wording/);
  } finally {
    removeTmpDir(tmp);
  }
});

test("R6: PASS is based on zero blocking findings and ignores advisory count", () => {
  assert.equal(JSON.parse(formatImplReviewJson({
    blockingFindings: [],
    nonBlockingImprovements: [{
      title: "Optional cleanup",
      failureMode: "refactor",
      file: "src/flow/commands/review.js",
      issue: "Could be shorter.",
      suggestion: "Extract a helper.",
      rationale: "Readability only.",
    }],
    excluded: { missingFile: 0, outOfScope: 0 },
  })).verdict, "ADVISORY");

  assert.equal(JSON.parse(formatImplReviewJson({
    blockingFindings: [],
    nonBlockingImprovements: [],
    excluded: { missingFile: 0, outOfScope: 0 },
  })).verdict, "PASS");
});

test("R7: flow run review parses PASS ADVISORY and FAIL impl artifact verdicts", () => {
  const pass = parseImplReviewOutput(
    { ok: true },
    "Impl review PASS. No blocking findings or non-blocking improvements recorded. See review.md.",
    "  [review] Results saved to specs/demo/review.md\n  [review] verdict=PASS blocking=0 nonBlocking=0",
  );
  assert.equal(pass.next, "gate-impl");
  assert.deepEqual(pass.artifacts, {
    phase: "impl",
    verdict: "PASS",
    blockingCount: 0,
    nonBlockingCount: 0,
  });

  const advisory = parseImplReviewOutput(
    { ok: true },
    "Impl review ADVISORY. 1 non-blocking improvement(s) recorded. See review.md.",
    "  [review] Results saved to specs/demo/review.md\n  [review] verdict=ADVISORY blocking=0 nonBlocking=1",
  );
  assert.equal(advisory.next, "gate-impl");
  assert.deepEqual(advisory.artifacts, {
    phase: "impl",
    verdict: "ADVISORY",
    blockingCount: 0,
    nonBlockingCount: 1,
  });

  const fail = parseImplReviewOutput(
    { ok: true },
    "Impl review FAIL. 1 blocking finding(s) recorded. See review.md.",
    "  [review] Results saved to specs/demo/review.md\n  [review] verdict=FAIL blocking=1 nonBlocking=0",
  );
  assert.equal(fail.next, null);
  assert.equal(fail.artifacts.verdict, "FAIL");
});

test("R7: impl review command path returns structured PASS ADVISORY and FAIL verdict artifacts", async () => {
  const tmp = createTmpDir("impl-review-command-r7-");
  try {
    fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), JSON.stringify({
      requirements: [{ id: "R7", desc: "structured verdicts" }],
    }));

    const pass = await runImplReview({
      root: tmp,
      flow: { spec: "specs/demo/spec.json" },
      reviewOutput: JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] }),
      touchedFiles: new Set(["src/flow/lib/run-review.js"]),
    });
    const advisory = await runImplReview({
      root: tmp,
      flow: { spec: "specs/demo/spec.json" },
      reviewOutput: JSON.stringify({
        blockingFindings: [],
        nonBlockingImprovements: [{
          title: "Optional branch wording",
          failureMode: "naming",
          file: "src/flow/lib/run-review.js",
          issue: "A branch name could be clearer.",
          suggestion: "Rename it.",
          rationale: "Readability-only.",
        }],
      }),
      touchedFiles: new Set(["src/flow/lib/run-review.js"]),
    });
    const fail = await runImplReview({
      root: tmp,
      flow: { spec: "specs/demo/spec.json" },
      reviewOutput: JSON.stringify({
        blockingFindings: [{
          title: "Missing R7",
          failureMode: "missing_acceptance_requirement",
          requirementId: "R7",
          issue: "Structured verdicts are missing.",
          suggestion: "Return verdict artifacts.",
          rationale: "R7 requires them.",
        }],
        nonBlockingImprovements: [],
      }),
      touchedFiles: new Set(["src/flow/lib/run-review.js"]),
    });

    assert.equal(pass.artifacts.verdict, "PASS");
    assert.equal(pass.next, "gate-impl");
    assert.equal(advisory.artifacts.verdict, "ADVISORY");
    assert.equal(advisory.next, "gate-impl");
    assert.equal(fail.artifacts.verdict, "FAIL");
    assert.notEqual(fail.next, "gate-impl");
  } finally {
    removeTmpDir(tmp);
  }
});

test("R8: PASS and ADVISORY reset reviewRetry and route to gate-impl", () => {
  for (const verdict of ["PASS", "ADVISORY"]) {
    const metrics = appendMetricsFor({
      artifacts: { phase: "impl", verdict, blockingCount: 0, nonBlockingCount: verdict === "ADVISORY" ? 1 : 0 },
    });
    assert.deepEqual(metrics, [{
      payload: { phase: "impl", counter: "reviewRetry", delta: 0, reset: true },
      opts: { taskId: null },
    }]);
  }
});

test("R9: FAIL consumes reviewRetry and does not advance to gate-impl", () => {
  const result = parseImplReviewOutput(
    { ok: true },
    "Impl review FAIL. 1 blocking finding(s) recorded. See review.md.",
    "  [review] Results saved to specs/demo/review.md\n  [review] verdict=FAIL blocking=1 nonBlocking=0",
  );
  assert.notEqual(result.next, "gate-impl");
  assert.deepEqual(appendMetricsFor(result), [{
    payload: { phase: "impl", counter: "reviewRetry", delta: 1 },
    opts: { taskId: null },
  }]);
});

test("R10: previous impl review memory is bounded and includes verdict counts and acknowledged advisory context", () => {
  const tmp = createTmpDir("impl-review-memory-");
  try {
    const specDir = path.join(tmp, "specs/demo");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "impl-review.json"), formatImplReviewJson({
      blockingFindings: Array.from({ length: 6 }, (_, index) => ({
        title: `Missing artifact ${index} ${"x".repeat(600)}`,
        failureMode: "missing_acceptance_requirement",
        requirementId: "R4",
        issue: `impl-review.json is not written. ${"y".repeat(600)}`,
        suggestion: "Write the artifact.",
        rationale: "R4 requires the artifact.",
      })),
      nonBlockingImprovements: Array.from({ length: 8 }, (_, index) => ({
        title: `Advisory ${index}`,
        failureMode: "refactor",
        file: "src/flow/commands/review.js",
        issue: "Optional improvement.",
        suggestion: "Keep it visible but bounded.",
        rationale: "Non-blocking.",
      })),
      excluded: { missingFile: 0, outOfScope: 0 },
    }));

    const memory = loadPreviousImplReviewMemory(tmp, "specs/demo/spec.json");
    assert.equal(memory.verdict, "FAIL");
    assert.deepEqual(memory.counts, { blocking: 6, nonBlocking: 8, total: 14 });
    assert.ok(memory.previousBlockingFindings.length <= 3);
    assert.ok(memory.acknowledgedNonBlockingImprovements.length <= 5);
    assert.ok(JSON.stringify(memory).length < 5000);
    assert.ok(memory.previousBlockingFindings.every((item) => JSON.stringify(item).length < 1200));
  } finally {
    removeTmpDir(tmp);
  }
});

test("R11: implement, impl-review, and reviewer prompts share the same three blocking labels", () => {
  const files = [
    "src/flow/prompts/impl/review.md",
    "src/flow/prompts/impl/implement.md",
  ];
  const reviewerPrompt = `${buildImplReviewPrompt({
    requirementFileMap: { R1: ["src/flow/commands/review.js"] },
    diff: "diff",
    touchedFiles: ["src/flow/commands/review.js"],
  }).systemPrompt}`;

  for (const mode of BLOCKING_MODES) {
    assert.match(reviewerPrompt, new RegExp(mode));
    for (const file of files) {
      assert.match(fs.readFileSync(file, "utf8"), new RegExp(mode));
    }
  }
});

test("R12: non-blocking prompt guidance requires touched file, observable issue, and replacement action", () => {
  const prompt = buildImplReviewPrompt({
    requirementFileMap: { R1: ["src/flow/commands/review.js"] },
    diff: "diff",
    touchedFiles: ["src/flow/commands/review.js"],
  });
  const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`;
  assert.match(combined, /optional/i);
  assert.match(combined, /touched file/i);
  assert.match(combined, /observable issue/i);
  assert.match(combined, /replacement action/i);
  assert.match(combined, /function, branch, assertion, prompt sentence, or artifact field/i);
});

test("R13: scope filtering applies to both buckets while valid missing-acceptance requirement blockers remain", () => {
  const filtered = filterImplReviewFindingsByScope({
    parsed: {
      blockingFindings: [
        {
          title: "Missing R4",
          failureMode: "missing_acceptance_requirement",
          requirementId: "R4",
          file: "",
          issue: "impl-review.json is missing.",
          suggestion: "Write it.",
          rationale: "Required artifact.",
        },
        {
          title: "Missing file blocker",
          failureMode: "spec_behavior_contradiction",
          file: "",
          issue: "No file was provided.",
          suggestion: "Drop it.",
          rationale: "File-specific blockers require a touched file.",
        },
        {
          title: "Wrong file",
          failureMode: "spec_behavior_contradiction",
          file: "src/outside.js",
          issue: "Outside diff.",
          suggestion: "Ignore.",
          rationale: "Out of scope.",
        },
      ],
      nonBlockingImprovements: [
        {
          title: "Missing file advisory",
          failureMode: "refactor",
          file: "",
          issue: "No file.",
          suggestion: "Drop it.",
          rationale: "Cannot apply.",
        },
        {
          title: "Outside advisory",
          failureMode: "refactor",
          file: "src/outside.js",
          issue: "Outside diff.",
          suggestion: "Drop it.",
          rationale: "Out of scope.",
        },
        {
          title: "Inside advisory",
          failureMode: "refactor",
          file: "src/flow/commands/review.js",
          issue: "Optional issue.",
          suggestion: "Optional fix.",
          rationale: "Non-blocking.",
        },
      ],
    },
    touchedFiles: new Set(["src/flow/commands/review.js"]),
    requirementIds: new Set(["R4"]),
  });

  assert.deepEqual(filtered.excluded, { missingFile: 2, outOfScope: 2 });
  assert.equal(filtered.blockingFindings.length, 1);
  assert.equal(filtered.blockingFindings[0].requirementId, "R4");
  assert.equal(filtered.nonBlockingImprovements.length, 1);
});

test("R13: impl review command path writes only scope-filtered findings and excluded counts", async () => {
  const tmp = createTmpDir("impl-review-command-r13-");
  try {
    fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), JSON.stringify({
      requirements: [{ id: "R13", desc: "scope filter review findings" }],
    }));

    await runImplReview({
      root: tmp,
      flow: { spec: "specs/demo/spec.json" },
      reviewOutput: JSON.stringify({
        blockingFindings: [
          {
            title: "Keep security bug",
            failureMode: "security_or_data_integrity_bug",
            file: "src/flow/commands/review.js",
            issue: "A touched file bug.",
            suggestion: "Fix it.",
            rationale: "Touched file blocker.",
          },
          {
            title: "Drop missing file blocker",
            failureMode: "spec_behavior_contradiction",
            file: "",
            issue: "No file.",
            suggestion: "Drop it.",
            rationale: "File-specific blocker without a file.",
          },
          {
            title: "Drop outside blocker",
            failureMode: "spec_behavior_contradiction",
            file: "src/outside.js",
            issue: "Outside diff.",
            suggestion: "Drop it.",
            rationale: "Out of scope.",
          },
        ],
        nonBlockingImprovements: [
          {
            title: "Keep advisory",
            failureMode: "refactor",
            file: "src/flow/commands/review.js",
            issue: "Optional touched-file issue.",
            suggestion: "Optional fix.",
            rationale: "Non-blocking.",
          },
          {
            title: "Drop outside advisory",
            failureMode: "refactor",
            file: "src/outside.js",
            issue: "Outside diff.",
            suggestion: "Drop it.",
            rationale: "Out of scope.",
          },
        ],
      }),
      touchedFiles: new Set(["src/flow/commands/review.js"]),
    });

    const json = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-review.json"), "utf8"));
    assert.deepEqual(json.excluded, { missingFile: 1, outOfScope: 2 });
    assert.deepEqual(json.blockingFindings.map((item) => item.title), ["Keep security bug"]);
    assert.deepEqual(json.nonBlockingImprovements.map((item) => item.title), ["Keep advisory"]);
  } finally {
    removeTmpDir(tmp);
  }
});

test("R14: executable tests exercise impl review contracts", async () => {
  const parsed = parseImplReviewFindings(JSON.stringify({
    blockingFindings: [],
    nonBlockingImprovements: [{
      title: "Advisory",
      failureMode: "refactor",
      file: "src/flow/commands/review.js",
      issue: "Optional issue.",
      suggestion: "Optional replacement.",
      rationale: "Non-blocking.",
    }],
  }));
  const filtered = filterImplReviewFindingsByScope({
    parsed,
    touchedFiles: new Set(["src/flow/commands/review.js"]),
    requirementIds: new Set(["R1"]),
  });
  const json = JSON.parse(formatImplReviewJson(filtered));
  const md = formatImplReviewMd(json);
  const output = parseImplReviewOutput(
    { ok: true },
    "Impl review ADVISORY. 1 non-blocking improvement(s) recorded. See review.md.",
    "  [review] Results saved to specs/demo/review.md\n  [review] verdict=ADVISORY blocking=0 nonBlocking=1",
  );
  const metrics = appendMetricsFor(output);

  assert.equal(json.verdict, "ADVISORY");
  assert.match(md, /Advisory/);
  assert.equal(output.next, "gate-impl");
  assert.equal(metrics[0].payload.reset, true);

  const sharedCoverage = collectSharedImplReviewTestCoverage(process.cwd());
  assert.deepEqual(sharedCoverage.contracts.sort(), [
    "advisory-retry",
    "impl-review-json-rendering",
    "json-parsing",
    "phase-transitions",
    "review-md-rendering",
    "scope-filtering",
  ]);
  assert.ok(sharedCoverage.files.every((file) => file.startsWith("tests/unit/flow/")));
});

test("R15: registry post hook completes impl review only for PASS or ADVISORY", async () => {
  const passUpdates = [];
  await FLOW_COMMANDS.run.review.post({
    phase: null,
    flowState: {},
    flowManager: {
      appendMetric() {},
      updateStepStatus(stepId, status) {
        passUpdates.push({ stepId, status });
      },
    },
  }, {
    artifacts: { phase: "impl", verdict: "PASS", blockingCount: 0, nonBlockingCount: 0 },
  });
  assert.deepEqual(passUpdates, [{ stepId: "review", status: "done" }]);

  const advisoryUpdates = [];
  await FLOW_COMMANDS.run.review.post({
    phase: null,
    flowState: {},
    flowManager: {
      appendMetric() {},
      updateStepStatus(stepId, status) {
        advisoryUpdates.push({ stepId, status });
      },
    },
  }, {
    artifacts: { phase: "impl", verdict: "ADVISORY", blockingCount: 0, nonBlockingCount: 1 },
  });
  assert.deepEqual(advisoryUpdates, [{ stepId: "review", status: "done" }]);

  const failUpdates = [];
  const failSteps = buildInitialSteps();
  for (const id of [
    "branch",
    "prepare-spec",
    "draft",
    "review-draft-questions",
    "draft-questions-triage",
    "draft-questions-repair",
    "draft-refine",
    "review-draft-coverage",
    "draft-coverage-triage",
    "draft-coverage-repair",
    "gate-draft",
    "spec",
    "review-spec",
    "spec-review-triage",
    "spec-repair",
    "gate",
    "approval",
    "test",
    "scenario-validity",
    "review-test",
    "implement",
    "test-execute",
    "test-result-review",
  ]) {
    findStepById(failSteps, id).status = "done";
  }
  await FLOW_COMMANDS.run.review.post({
    phase: null,
    flowState: {
      steps: failSteps,
    },
    flowManager: {
      appendMetric() {},
      updateStepStatus(stepId, status) {
        failUpdates.push({ stepId, status });
      },
    },
  }, {
    artifacts: { phase: "impl", verdict: "FAIL", blockingCount: 1, nonBlockingCount: 0 },
  });
  assert.deepEqual(failUpdates, []);
  assert.equal(findStepById(failSteps, "review").status, "pending");
  assert.equal(findFirstPendingLeaf(failSteps).id, "review");
});

test("R16: task-scoped review uses the same structured artifact and verdict policy", async () => {
  const tmp = createTmpDir("impl-review-command-r16-");
  let result;
  try {
    fs.mkdirSync(path.join(tmp, "specs/demo/tasks"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), JSON.stringify({
      requirements: [{ id: "R16", desc: "task-scoped review contract" }],
    }));
    fs.writeFileSync(path.join(tmp, "specs/demo/tasks/T-1.md"), "# Task T-1\n");

    result = await runImplReview({
      root: tmp,
      flow: { spec: "specs/demo/spec.json" },
      taskSpec: { relPath: "specs/demo/tasks/T-1.md", task: { id: "T-1" } },
      reviewOutput: JSON.stringify({
        blockingFindings: [],
        nonBlockingImprovements: [{
          title: "Optional task cleanup",
          failureMode: "refactor",
          file: "src/flow/commands/review.js",
          issue: "A task-local helper could be smaller.",
          suggestion: "Extract a helper.",
          rationale: "Non-blocking cleanup.",
        }],
      }),
      touchedFiles: new Set(["src/flow/commands/review.js"]),
    });
  } finally {
    removeTmpDir(tmp);
  }

  assert.equal(result.next, "gate-impl");
  assert.equal(result.artifacts.taskId, "T-1");
  assert.equal(result.artifacts.target, "specs/demo/tasks/T-1.md");
  assert.equal(result.artifacts.verdict, "ADVISORY");

  const prompt = buildImplReviewPrompt({
    requirementFileMap: { R16: ["src/flow/commands/review.js"] },
    diff: "diff",
    touchedFiles: ["src/flow/commands/review.js"],
    taskSpec: { relPath: "specs/demo/tasks/T-1.md", content: "# Task T-1\n" },
  });
  const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`;
  assert.match(combined, /specs\/demo\/tasks\/T-1\.md/);
  assert.match(combined, /blockingFindings\[\]/);
  assert.match(combined, /nonBlockingImprovements\[\]/);
});

test("R17: task review prompt uses the same blocking and non-blocking policy as flow-level review", () => {
  const taskPrompt = fs.readFileSync("src/flow/prompts/task/review.md", "utf8");
  for (const mode of BLOCKING_MODES) {
    assert.match(taskPrompt, new RegExp(mode));
  }
  assert.match(taskPrompt, /blockingFindings\[\]/);
  assert.match(taskPrompt, /nonBlockingImprovements\[\]/);
  assert.doesNotMatch(taskPrompt, /proposals in review\.md/);
});
