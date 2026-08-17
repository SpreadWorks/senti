// spec: R4 R5 R8 R12
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import SetIssueLogCommand from "../../../src/flow/lib/set-issue-log.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

async function withTmpSpec(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "review-history-"));
  try {
    const specDir = path.join(root, "specs", "demo");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({ requirements: [] }, null, 2));
    return await fn({ root, specDir });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function implArtifact(blockingFindings = []) {
  return {
    version: 1,
    phase: "impl",
    blockingFindings,
    nonBlockingImprovements: [],
  };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test("R4: review artifact persistence writes latest and per-phase attempt history", async () => withTmpSpec(async ({ specDir }) => {
  const { writeReviewAttemptHistory } = await import(path.join(repoRoot, "src/flow/commands/review.js"));
  assert.equal(typeof writeReviewAttemptHistory, "function");

  const cases = [
    ["impl", "review.md", "# Code Review\n", "md"],
    ["impl", "impl-review.json", implArtifact(), "json"],
    ["spec", "spec-review.md", "# Spec Review\n", "md"],
    ["spec", "spec-review.json", { version: 1, phase: "spec", blockingFindings: [], nonBlockingImprovements: [] }, "json"],
    ["test", "test-review.md", "# Test Review\n", "md"],
    ["test", "test-review.json", { version: 1, phase: "test", blockingFindings: [], advisoryFindings: [] }, "json"],
    ["draft-questions", "draft-review-questions.json", { version: 1, phase: "draft-questions", blockingFindings: [], advisoryFindings: [], repairTargets: [] }, "json"],
    ["draft-coverage", "draft-review-coverage.json", { version: 1, phase: "draft-coverage", blockingFindings: [], advisoryFindings: [], repairTargets: [] }, "json"],
  ];

  for (const [phase, latestBasename, payload, ext] of cases) {
    const result = writeReviewAttemptHistory({
      specDir,
      phase,
      latestBasename,
      attemptNumber: 1,
      findings: [
        {
          title: `${phase} markdown finding`,
          body: "Normalized finding history for a markdown review artifact.",
          severity: "blocking",
          category: "unknown",
        },
      ],
      ...(ext === "json" ? { artifact: payload } : { content: payload }),
    });
    assert.equal(
      path.relative(specDir, result.historyPath),
      path.join("review-history", `${phase}-attempt-001.${ext}`),
    );
    assert.ok(fs.existsSync(path.join(specDir, latestBasename)), `${latestBasename} should be preserved`);
    assert.ok(fs.existsSync(result.historyPath), `${result.historyPath} should exist`);
    if (ext === "md") {
      assert.equal(
        path.relative(specDir, result.normalizedHistoryPath),
        path.join("review-history", `${phase}-attempt-001.json`),
      );
      const normalized = JSON.parse(fs.readFileSync(result.normalizedHistoryPath, "utf8"));
      assert.ok(normalized.findings.every((finding) =>
        finding.id && finding.phase === phase && finding.sourceArtifact === latestBasename &&
        finding.attempt === 1 && finding.severity && finding.title && finding.body && finding.category
      ));
    }
  }

  const next = writeReviewAttemptHistory({
    specDir,
    phase: "impl",
    latestBasename: "impl-review.json",
    attemptNumber: 2,
    artifact: implArtifact(),
  });
  assert.equal(path.relative(specDir, next.historyPath), path.join("review-history", "impl-attempt-002.json"));
}));

test("R5: repair issue-log entries can store normalized finding id and repair references", () => withTmpSpec(({ root }) => {
  const command = new SetIssueLogCommand();
  command.execute({
    root,
    step: "spec-repair",
    reason: "Repair addressed a normalized review finding reference.",
    trigger: "Spec review finding required a command contract repair.",
    resolution: "Recorded the finding id and changed file reference.",
    normalizedFindingId: "spec-001-blocking-001",
    repairRef: { files: ["src/metrics/commands/review.js"] },
    flowState: { spec: "specs/demo/spec.json", tasks: [] },
  });
  command.execute({
    root,
    step: "spec-repair",
    reason: "Repair entry has a finding id but no repair reference.",
    normalizedFindingId: "spec-002-blocking-001",
    flowState: { spec: "specs/demo/spec.json", tasks: [] },
  });
  command.execute({
    root,
    step: "spec-repair",
    reason: "Repair entry has changed files but no finding id.",
    repairRef: { files: ["src/flow/commands/review.js"] },
    flowState: { spec: "specs/demo/spec.json", tasks: [] },
  });
  command.execute({
    root,
    step: "spec-repair",
    reason: "Repair entry has a finding id and commit hash reference.",
    normalizedFindingId: "spec-003-blocking-001",
    repairRef: { commit: "0123456789abcdef0123456789abcdef01234567" },
    flowState: { spec: "specs/demo/spec.json", tasks: [] },
  });

  const log = JSON.parse(fs.readFileSync(path.join(root, "specs/demo/issue-log.json"), "utf8"));
  assert.equal(log.entries[0].normalizedFindingId, "spec-001-blocking-001");
  assert.deepEqual(log.entries[0].repairRef, { files: ["src/metrics/commands/review.js"] });
  assert.equal(log.entries[1].normalizedFindingId, "spec-002-blocking-001");
  assert.equal(log.entries[1].repairRef, undefined);
  assert.equal(log.entries[2].normalizedFindingId, undefined);
  assert.deepEqual(log.entries[2].repairRef, { files: ["src/flow/commands/review.js"] });
  assert.equal(log.entries[3].normalizedFindingId, "spec-003-blocking-001");
  assert.deepEqual(log.entries[3].repairRef, { commit: "0123456789abcdef0123456789abcdef01234567" });

  const modulePath = path.join(repoRoot, "src/metrics/commands/review.js");
  if (fs.existsSync(modulePath)) {
    return import(modulePath).then(async (mod) => {
      const loaded = await mod.loadReviewMetricsArtifacts(root);
      const aggregate = mod.aggregateReviewMetrics(loaded);
      assert.ok(aggregate.repairMetrics.diffCorrespondence.some((row) =>
        row.findingId === "spec-002-blocking-001" && row.status === "unknown"
      ));
      assert.ok(aggregate.repairMetrics.diffCorrespondence.some((row) =>
        row.detail.includes("src/flow/commands/review.js") && row.status === "unknown"
      ));
      assert.ok(aggregate.repairMetrics.diffCorrespondence.some((row) =>
        row.findingId === "spec-003-blocking-001" &&
        row.detail.includes("0123456789abcdef0123456789abcdef01234567") &&
        row.status !== "unknown"
      ));
    });
  }
}));

test("R8: attempt-level history normalizes stable ids categories severity and source fields", async () => withTmpSpec(async ({ specDir }) => {
  const { writeReviewAttemptHistory } = await import(path.join(repoRoot, "src/flow/commands/review.js"));
  const { historyJsonPath } = writeReviewAttemptHistory({
    specDir,
    phase: "impl",
    latestBasename: "impl-review.json",
    attemptNumber: 1,
    artifact: implArtifact([
      {
        title: "Missing tests",
        category: "wrong-category",
        failureMode: "missing_test_coverage",
        file: "src/metrics/commands/review.js",
        issue: "No review metrics test coverage.",
        suggestion: "Add tests.",
        rationale: "Repair metrics need regression coverage.",
      },
    ]),
  });
  const draft = writeReviewAttemptHistory({
    specDir,
    phase: "draft-questions",
    latestBasename: "draft-review-questions.json",
    attemptNumber: 1,
    artifact: {
      version: 1,
      phase: "draft-questions",
      repairTargets: [
        {
          title: "Need decision",
          target: "draft",
          category: "wrong-category",
          rationale: "Question requires a user decision.",
          evidence: "Draft question artifact.",
          classification: "repair_target",
        },
      ],
    },
  });
  const spec = writeReviewAttemptHistory({
    specDir,
    phase: "spec",
    latestBasename: "spec-review.json",
    attemptNumber: 1,
    artifact: {
      version: 1,
      phase: "spec",
      blockingFindings: [
        {
          title: "Spec category field",
          body: "Spec finding has a category-like field.",
          category: "complete-context",
        },
      ],
    },
  });
  const testReview = writeReviewAttemptHistory({
    specDir,
    phase: "test",
    latestBasename: "test-review.json",
    attemptNumber: 1,
    artifact: {
      version: 1,
      phase: "test",
      advisoryFindings: [
        {
          title: "Missing category fallback",
          target: "tests",
          issue: "No category-like field is present.",
          requiredChange: "Use unknown category.",
          whyBlocking: "Category fallback must be explicit.",
        },
      ],
    },
  });
  const markdown = writeReviewAttemptHistory({
    specDir,
    phase: "impl",
    latestBasename: "review.md",
    attemptNumber: 2,
    content: "# Review\n",
    findings: [
      { title: "Invalid severity", body: "Severity should normalize.", severity: "critical" },
      { title: "Improvement severity", body: "Improvement should normalize.", severity: "improvement" },
    ],
  });

  const history = JSON.parse(fs.readFileSync(historyJsonPath, "utf8"));
  assert.deepEqual(history.findings.map((finding) => ({
    id: finding.id,
    phase: finding.phase,
    sourceArtifact: finding.sourceArtifact,
    attempt: finding.attempt,
    severity: finding.severity,
    category: finding.category,
    title: finding.title,
  })), [
    {
      id: "impl-001-blocking-001",
      phase: "impl",
      sourceArtifact: "impl-review.json",
      attempt: 1,
      severity: "blocking",
      category: "missing_test_coverage",
      title: "Missing tests",
    },
  ]);
  assert.equal(JSON.parse(fs.readFileSync(draft.historyJsonPath, "utf8")).findings[0].category, "repair_target");
  assert.equal(JSON.parse(fs.readFileSync(spec.historyJsonPath, "utf8")).findings[0].category, "complete-context");
  const testFinding = JSON.parse(fs.readFileSync(testReview.historyJsonPath, "utf8")).findings[0];
  assert.equal(testFinding.category, "unknown");
  assert.equal(testFinding.severity, "non-blocking");
  assert.deepEqual(
    JSON.parse(fs.readFileSync(markdown.normalizedHistoryPath, "utf8")).findings.map((finding) => finding.severity),
    ["blocking", "non-blocking"],
  );
}));

test("R12: metrics review domain values are represented by dedicated classes", async () => withTmpSpec(async ({ root, specDir }) => {
  const modulePath = path.join(repoRoot, "src/metrics/commands/review.js");
  assert.ok(fs.existsSync(modulePath), "src/metrics/commands/review.js should exist");
  const mod = await import(modulePath);
  for (const name of [
    "ReviewMetricsSpec",
    "ReviewFinding",
    "RepairOutcome",
    "AggregateRow",
    "ReviewMetricsTextFormatter",
    "ReviewMetricsJsonFormatter",
    "ReviewMetricsCsvFormatter",
  ]) {
    assert.equal(typeof mod[name], "function", `${name} should be a class export`);
  }

  const finding = new mod.ReviewFinding({
    id: "spec-001-blocking-001",
    spec: "alpha",
    phase: "spec",
    sourceArtifact: "spec-review.json",
    attempt: 1,
    severity: "blocking",
    title: "Missing exit code contract",
    body: "Define success and failure exits.",
    category: "complete-context",
  });
  assert.equal(finding.id, "spec-001-blocking-001");
  assert.equal(finding.toJSON().category, "complete-context");

  writeJson(path.join(specDir, "issue-log.json"), {
    entries: [
      {
        step: "gate",
        reason: "Spec gate rejected an ambiguous requirement.",
        guardrailId: "complete-context",
      },
      {
        step: "spec-repair",
        reason: "Repair addressed the normalized finding.",
        normalizedFindingId: "spec-001-blocking-001",
        repairRef: { files: ["src/metrics/commands/review.js"] },
      },
    ],
  });
  writeJson(path.join(specDir, "flow.json"), {
    state: { spec: "specs/demo/spec.json" },
    metricsSummary: { flow: { spec: { gateRetry: 1 } } },
  });
  writeJson(path.join(specDir, "review-history/spec-attempt-001.json"), {
    version: 1,
    phase: "spec",
    sourceArtifact: "spec-review.json",
    attempt: 1,
    findings: [finding.toJSON()],
  });

  const loaded = await mod.loadReviewMetricsArtifacts(root);
  assert.ok(loaded.specs[0] instanceof mod.ReviewMetricsSpec);
  assert.ok(loaded.findings[0] instanceof mod.ReviewFinding);
  assert.ok(loaded.repairs[0] instanceof mod.RepairOutcome);

  const aggregate = mod.aggregateReviewMetrics(loaded);
  assert.ok(aggregate.findingTrends[0] instanceof mod.AggregateRow);
  assert.ok(new mod.ReviewMetricsTextFormatter(aggregate).format().includes("Review Finding Trends"));
  assert.ok(JSON.parse(new mod.ReviewMetricsJsonFormatter(aggregate).format()).findings.length >= 1);
  assert.match(new mod.ReviewMetricsCsvFormatter(aggregate).format().split("\n")[0], /^section,spec,phase,category,count,rate,status,detail$/);
}));
