// spec: R1 R2 R3 R6 R7 R9 R10 R11 R13
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");
const metricsEntry = path.join(repoRoot, "src", "metrics.js");

function withFixture(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "metrics-review-"));
  try {
    fs.mkdirSync(path.join(root, "specs", "alpha", "review-history"), { recursive: true });
    fs.mkdirSync(path.join(root, "specs", "beta", "review-history"), { recursive: true });
    fs.mkdirSync(path.join(root, "specs", "beta"), { recursive: true });
    fs.mkdirSync(path.join(root, "specs", "gamma"), { recursive: true });
    writeJson(root, "specs/alpha/spec.json", { requirements: [{ id: "R1", desc: "alpha" }] });
    writeJson(root, "specs/beta/spec.json", { requirements: [{ id: "R1", desc: "beta" }] });
    writeJson(root, "specs/gamma/spec.json", { requirements: [{ id: "R1", desc: "gamma" }] });
    writeJson(root, "specs/alpha/issue-log.json", {
      entries: [
        {
          step: "gate",
          reason: "Spec gate rejected an ambiguous requirement.",
          guardrailId: "unambiguous-requirements",
          phase: "spec",
          observations: [
            { requirementRef: "unambiguous-requirements", status: "fail" },
            { refs: ["unambiguous-requirements"], status: "fail" },
          ],
        },
        {
          step: "spec-repair",
          reason: "Repair addressed a normalized review finding.",
          normalizedFindingId: "spec-001-blocking-001",
          repairRef: { files: ["src/metrics/commands/review.js"] },
        },
      ],
    });
    writeJson(root, "specs/beta/issue-log.json", {
      entries: [
        {
          step: "review",
          reason: "Review max attempts exhausted before implementation could proceed.",
          result: "REVIEW_MAX_ATTEMPTS_EXCEEDED",
          phase: "test",
        },
      ],
    });
    writeJson(root, "specs/alpha/flow.json", {
      state: { spec: "specs/alpha/spec.json" },
      metricsSummary: {
        flow: {
          spec: { gateRetry: 5, reviewRetry: 3 },
        },
      },
    });
    writeJson(root, "specs/alpha/review-history/spec-attempt-001.json", {
      version: 1,
      phase: "spec",
      sourceArtifact: "spec-review.json",
      attempt: 1,
      findings: [
        {
          id: "spec-001-blocking-001",
          phase: "spec",
          sourceArtifact: "spec-review.json",
          attempt: 1,
          severity: "blocking",
          title: "Missing exit code contract",
          body: "Define metrics review success and failure exit codes.",
          category: "complete-context",
        },
        {
          id: "spec-001-improvement-001",
          phase: "spec",
          sourceArtifact: "spec-review.json",
          attempt: 1,
          severity: "non-blocking",
          title: "Pin filename pattern",
          body: "State the history filename pattern explicitly.",
          category: "process",
        },
      ],
    });
    writeJson(root, "specs/alpha/review-history/spec-attempt-002.json", {
      version: 1,
      phase: "spec",
      sourceArtifact: "spec-review.json",
      attempt: 2,
      findings: [
        {
          id: "spec-002-blocking-001",
          phase: "spec",
          sourceArtifact: "spec-review.json",
          attempt: 2,
          severity: "blocking",
          title: "Exit code contract still unclear",
          body: "A later finding reappears in the same category.",
          category: "complete-context",
        },
      ],
    });
    writeJson(root, "specs/beta/review-history/impl-attempt-001.json", historyFinding({
      id: "impl-001-blocking-001",
      phase: "impl",
      sourceArtifact: "impl-review.json",
      severity: "blocking",
      category: "missing_test_coverage",
      title: "Missing implementation tests",
    }));
    writeJson(root, "specs/beta/review-history/test-attempt-001.json", historyFinding({
      id: "test-001-advisory-001",
      phase: "test",
      sourceArtifact: "test-review.json",
      severity: "non-blocking",
      category: "unknown",
      title: "Add edge fixture",
    }));
    writeJson(root, "specs/beta/review-history/draft-questions-attempt-001.json", historyFinding({
      id: "draft-questions-001-blocking-001",
      phase: "draft-questions",
      sourceArtifact: "draft-review-questions.json",
      severity: "blocking",
      category: "repair_target",
      title: "Missing user decision",
    }));
    writeJson(root, "specs/beta/review-history/draft-coverage-attempt-001.json", historyFinding({
      id: "draft-coverage-001-blocking-001",
      phase: "draft-coverage",
      sourceArtifact: "draft-review-coverage.json",
      severity: "blocking",
      category: "blocking",
      title: "Draft omits coverage",
    }));
    writeJson(root, "specs/beta/spec-review.json", {
      version: 1,
      phase: "spec",
      verdict: "ADVISORY",
      blockingFindings: [],
      nonBlockingImprovements: [
        {
          title: "Latest spec finding",
          body: "Latest spec-review snapshot should also be scanned.",
          category: "unknown",
        },
      ],
    });
    writeJson(root, "specs/beta/test-review.json", {
      version: 1,
      phase: "test",
      verdict: "ADVISORY",
      blockingFindings: [],
      advisoryFindings: [
        {
          title: "Latest test review finding",
          target: "tests",
          issue: "Latest test-review snapshot should be scanned.",
          requiredChange: "Read latest test review artifacts.",
          whyBlocking: "Coverage would be incomplete otherwise.",
        },
      ],
    });
    writeJson(root, "specs/beta/draft-review-questions.json", {
      version: 1,
      phase: "draft-questions",
      verdict: "ADVISORY",
      repairTargets: [
        {
          title: "Latest draft question finding",
          target: "draft",
          rationale: "Question needs a decision.",
          evidence: "Draft question artifact.",
          classification: "repair_target",
        },
      ],
    });
    writeJson(root, "specs/beta/draft-review-coverage.json", {
      version: 1,
      phase: "draft-coverage",
      verdict: "FAIL",
      blockingFindings: [
        {
          title: "Latest draft coverage finding",
          target: "draft",
          rationale: "Coverage is incomplete.",
          evidence: "Draft coverage artifact.",
          classification: "blocking",
        },
      ],
    });
    writeJson(root, "specs/beta/impl-review.json", {
      version: 1,
      phase: "impl",
      verdict: "FAIL",
      blockingFindings: [
        {
          title: "Latest impl finding",
          failureMode: "missing_test_coverage",
          file: "src/metrics/commands/review.js",
          issue: "Latest impl-review snapshot should be scanned.",
          suggestion: "Read latest impl review artifacts.",
          rationale: "Finding trends require latest artifacts.",
        },
      ],
      nonBlockingImprovements: [],
    });
    writeJson(root, "specs/beta/flow.json", {
      state: { spec: "specs/beta/spec.json" },
      metricsSummary: { flow: { spec: { reviewRetry: 0 } } },
    });
    writeJson(root, "specs/gamma/flow.json", {
      state: { spec: "specs/gamma/spec.json" },
      metricsSummary: { flow: {} },
    });
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function writeJson(root, rel, value) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function historyFinding({ id, phase, sourceArtifact, severity, category, title }) {
  return {
    version: 1,
    phase,
    sourceArtifact,
    attempt: 1,
    findings: [
      {
        id,
        phase,
        sourceArtifact,
        attempt: 1,
        severity,
        title,
        body: `${title} body.`,
        category,
      },
    ],
  };
}

function withRoot(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "metrics-review-empty-"));
  try {
    return fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function runMetrics(root, args) {
  return spawnSync(process.execPath, [metricsEntry, "review", ...args], {
    cwd: repoRoot,
    env: {
      ...process.env,
      SDD_FORGE_WORK_ROOT: root,
      SDD_FORGE_SOURCE_ROOT: repoRoot,
    },
    encoding: "utf8",
  });
}

test("R1: metrics review validates arguments and preserves token help", () => withFixture((root) => {
  const parentHelp = spawnSync(process.execPath, [metricsEntry, "--help"], {
    cwd: repoRoot,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: root, SDD_FORGE_SOURCE_ROOT: repoRoot },
    encoding: "utf8",
  });
  assert.equal(parentHelp.status, 0);
  assert.match(parentHelp.stderr + parentHelp.stdout, /\breview\b/);

  const help = runMetrics(root, ["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /sdd-forge metrics review/);
  assert.match(help.stdout, /--format <text\|json\|csv>/);
  assert.match(help.stdout, /--search <text>/);

  const invalidFormat = runMetrics(root, ["--format", "xml"]);
  assert.notEqual(invalidFormat.status, 0);
  assert.match(invalidFormat.stderr, /format/i);

  const missingSearch = runMetrics(root, ["--search"]);
  assert.notEqual(missingSearch.status, 0);
  assert.match(missingSearch.stderr, /search/i);

  const emptySearch = runMetrics(root, ["--search", ""]);
  assert.notEqual(emptySearch.status, 0);
  assert.match(emptySearch.stderr, /search/i);

  const whitespaceSearch = runMetrics(root, ["--search", "   "]);
  assert.notEqual(whitespaceSearch.status, 0);
  assert.match(whitespaceSearch.stderr, /search/i);

  const longSearch = runMetrics(root, ["--search", "x".repeat(257)]);
  assert.notEqual(longSearch.status, 0);
  assert.match(longSearch.stderr, /search/i);

  const trimmedSearch = runMetrics(root, ["--format", "json", "--search", "  complete-context  "]);
  assert.equal(trimmedSearch.status, 0, trimmedSearch.stderr);
  assert.deepEqual(JSON.parse(trimmedSearch.stdout).searchResults.map((finding) => finding.id), ["spec-001-blocking-001", "spec-002-blocking-001"]);

  const defaultText = runMetrics(root, []);
  assert.equal(defaultText.status, 0, defaultText.stderr);
  assert.match(defaultText.stdout, /Guardrail Violations/);

  const tokenHelp = spawnSync(process.execPath, [metricsEntry, "token", "--help"], {
    cwd: repoRoot,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: root, SDD_FORGE_SOURCE_ROOT: repoRoot },
    encoding: "utf8",
  });
  assert.equal(tokenHelp.status, 0);
  assert.match(tokenHelp.stdout, /sdd-forge metrics token/);

  writeJson(root, "specs/token-sample/flow.json", {
    state: { finalizedAt: "2026-01-01T00:00:00.000Z" },
    metrics: {
      draft: {
        tokens: { input: 100, output: 50, cacheRead: 20, cacheCreation: 10 },
        callCount: 2,
        cost: 0.01,
      },
    },
  });
  const tokenJson = spawnSync(process.execPath, [metricsEntry, "token", "--format", "json"], {
    cwd: repoRoot,
    env: { ...process.env, SDD_FORGE_WORK_ROOT: root, SDD_FORGE_SOURCE_ROOT: repoRoot },
    encoding: "utf8",
  });
  assert.equal(tokenJson.status, 0, tokenJson.stderr);
  const tokenReport = JSON.parse(tokenJson.stdout);
  const draftRow = tokenReport.rows.find((row) => row.phase === "draft");
  assert.equal(draftRow.tokenInput, 100);
  assert.equal(draftRow.tokenOutput, 50);
  assert.equal(draftRow.callCount, 2);
}));

test("R1: metrics review succeeds with no specs and fails for required path or JSON read errors", () => withRoot((root) => {
  const absent = runMetrics(root, ["--format", "json"]);
  assert.equal(absent.status, 0, absent.stderr);
  assert.deepEqual(JSON.parse(absent.stdout).specs, []);

  fs.mkdirSync(path.join(root, "specs"), { recursive: true });
  const empty = runMetrics(root, ["--format", "json"]);
  assert.equal(empty.status, 0, empty.stderr);
  assert.deepEqual(JSON.parse(empty.stdout).specs, []);

  fs.rmSync(path.join(root, "specs"), { recursive: true, force: true });
  fs.writeFileSync(path.join(root, "specs"), "not a directory");
  const badPath = runMetrics(root, ["--format", "json"]);
  assert.notEqual(badPath.status, 0);
  assert.match(badPath.stderr, /specs/i);

  fs.rmSync(path.join(root, "specs"), { force: true });
  fs.mkdirSync(path.join(root, "specs", "bad"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", "bad", "issue-log.json"), "{ broken json");
  const badJson = runMetrics(root, ["--format", "json"]);
  assert.notEqual(badJson.status, 0);
  assert.match(badJson.stderr, /json|parse/i);
}));

test("R2: JSON report aggregates guardrails and attempt-limit evidence from issue-log and flow.json", () => withFixture((root) => {
  const result = runMetrics(root, ["--format", "json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);

  assert.deepEqual(
    report.guardrails.map((row) => [row.guardrailId, row.count]),
    [["unambiguous-requirements", 2]],
  );
  assert.deepEqual(
    report.repairMetrics.attemptLimitSpecs.map((row) => row.spec),
    ["alpha", "beta"],
  );
  assert.equal(report.repairMetrics.attemptLimitSpecs[0].source, "flow.json");
  assert.equal(report.repairMetrics.attemptLimitSpecs[1].source, "issue-log.json");
  assert.ok(report.phaseDistribution.some((row) => row.phase === "gate" && row.count === 2));
  assert.ok(report.phaseDistribution.some((row) => row.phase === "review" && row.count === 1));
}));

test("R3: review artifacts normalize findings by phase category and spec", () => withFixture((root) => {
  const result = runMetrics(root, ["--format", "json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);

  const phaseSet = new Set(report.findings.map((finding) => finding.phase));
  assert.deepEqual([...phaseSet].sort(), ["draft-coverage", "draft-questions", "impl", "spec", "test"]);
  const sourceSet = new Set(report.findings.map((finding) => finding.sourceArtifact));
  for (const basename of [
    "impl-review.json",
    "spec-review.json",
    "test-review.json",
    "draft-review-questions.json",
    "draft-review-coverage.json",
  ]) {
    assert.ok(sourceSet.has(basename), `${basename} should be scanned`);
  }

  const specFinding = report.findings.find((finding) => finding.id === "spec-001-blocking-001");
  assert.deepEqual({
    spec: specFinding.spec,
    phase: specFinding.phase,
    category: specFinding.category,
    severity: specFinding.severity,
    attempt: specFinding.attempt,
  }, {
    spec: "alpha",
    phase: "spec",
    category: "complete-context",
    severity: "blocking",
    attempt: 1,
  });
  assert.ok(report.findingTrends.some((row) =>
    row.spec === "beta" && row.phase === "draft-coverage" && row.category === "blocking" && row.count >= 1
  ));

  for (const title of [
    "Latest impl finding",
    "Latest spec finding",
    "Latest test review finding",
    "Latest draft question finding",
    "Latest draft coverage finding",
  ]) {
    assert.ok(report.findings.some((finding) => finding.title === title), `${title} should come from latest artifacts`);
  }
}));

test("R6: repair effectiveness uses adjacent recorded attempts and reports missing history explicitly", () => withFixture((root) => {
  const result = runMetrics(root, ["--format", "json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);

  assert.deepEqual(report.repairMetrics.disappearanceRate, {
    numerator: 1,
    denominator: 1,
    percentage: 100,
    status: "recorded",
  });
  assert.deepEqual(report.repairMetrics.sameCategoryReappearanceRate, {
    numerator: 1,
    denominator: 1,
    percentage: 100,
    status: "recorded",
  });
  assert.ok(report.missingData.entries.some((entry) =>
    entry.spec === "gamma" && entry.status === "not recorded"
  ));
}));

test("R7: --search filters by keyword and exact category", () => withFixture((root) => {
  const byCategory = runMetrics(root, ["--format", "json", "--search", "COMPLETE-CONTEXT"]);
  assert.equal(byCategory.status, 0, byCategory.stderr);
  const categoryReport = JSON.parse(byCategory.stdout);
  assert.deepEqual(categoryReport.searchResults.map((finding) => finding.id), ["spec-001-blocking-001", "spec-002-blocking-001"]);

  const byKeyword = runMetrics(root, ["--format", "json", "--search", "FileName"]);
  assert.equal(byKeyword.status, 0, byKeyword.stderr);
  const keywordReport = JSON.parse(byKeyword.stdout);
  assert.deepEqual(keywordReport.searchResults.map((finding) => finding.id), ["spec-001-improvement-001"]);

  const byCategoryKeyword = runMetrics(root, ["--format", "json", "--search", "context"]);
  assert.equal(byCategoryKeyword.status, 0, byCategoryKeyword.stderr);
  const categoryKeywordReport = JSON.parse(byCategoryKeyword.stdout);
  assert.ok(categoryKeywordReport.searchResults.some((finding) => finding.category === "complete-context"));
}));

test("R9: text output has required sections sorted count tables and explicit unknown statuses", () => withFixture((root) => {
  const result = runMetrics(root, ["--format", "text", "--search", "complete-context"]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Guardrail Violations/);
  assert.match(result.stdout, /Review Finding Trends/);
  assert.match(result.stdout, /Repair Effectiveness/);
  assert.match(result.stdout, /Missing Data/);
  assert.match(result.stdout, /Search Results/);
  assert.match(result.stdout, /1\/1\s+100%/);
  assert.match(result.stdout, /not recorded|unknown/);
}));

test("R10: JSON output uses null plus status for unknown values", () => withFixture((root) => {
  const result = runMetrics(root, ["--format", "json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  const missing = report.missingData.entries.find((entry) => entry.spec === "gamma");
  assert.equal(report.missingData.count, 1);
  assert.equal(report.missingData.totalSpecs, 3);
  assert.equal(report.missingData.recordedSpecs, 2);
  assert.equal(missing.value, null);
  assert.equal(missing.status, "not recorded");
}));

test("R11: CSV output has stable headers and separates unknown status from numeric columns", () => withFixture((root) => {
  const result = runMetrics(root, ["--format", "csv"]);
  assert.equal(result.status, 0, result.stderr);
  const lines = result.stdout.trim().split("\n");
  assert.equal(lines[0], "section,spec,phase,category,count,rate,status,detail");
  const rows = lines.slice(1).map(parseCsvLine);
  assert.ok(rows.some((row) =>
    row[0] === "missing-data" && row[1] === "gamma" && row[4] === "" && row[5] === "" && row[6] === "not recorded"
  ));
  assert.ok(rows.some((row) =>
    row[0] === "repair-effectiveness" && row[1] === "alpha" && row[2] === "spec" && row[4] === "1" && row[5] === "100" && row[6] === "recorded"
  ));

  const searchResult = runMetrics(root, ["--format", "csv", "--search", "complete-context"]);
  assert.equal(searchResult.status, 0, searchResult.stderr);
  const searchRows = searchResult.stdout.trim().split("\n").slice(1).map(parseCsvLine);
  assert.ok(searchRows.some((row) =>
    row[0] === "search-results" && row[2] === "spec" && row[3] === "complete-context" && row[6] === "recorded"
  ));
}));

test("R13: metrics review spec fixtures exercise command dispatch loading search and all output formats", () => withFixture((root) => {
  for (const format of ["text", "json", "csv"]) {
    const result = runMetrics(root, ["--format", format, "--search", "context"]);
    assert.equal(result.status, 0, `${format} failed:\n${result.stderr}`);
    assert.ok(result.stdout.trim().length > 0);
  }
}));
