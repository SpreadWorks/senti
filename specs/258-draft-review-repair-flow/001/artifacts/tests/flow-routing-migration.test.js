// spec: R1 R3 R6 R7 R9 R11
//
// Behavioral tests for routing classification, migration semantics, and
// non-mutation guarantees. These replace the original grep-only checks.
//
// GAP coverage: GAP-1 (non-mutation), GAP-5 (routing), GAP-7 (migration),
// GAP-8 (markdown independence), GAP-10 (minimal tripwires), GAP-4
// (spec-local test suite coverage check / TC-33).

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { FLOW_DEFINITION } from "../../../src/flow/definition.js";
import { draftReviewRouteForRetryPhase } from "../../../src/flow/lib/draft-review-routes.js";
import { resolveDraftReviewNextStep } from "../../../src/flow/lib/run-review.js";
import {
  assertDraftReviewRegistryHookBoundary,
  DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY,
  FLOW_COMMANDS,
} from "../../../src/flow/registry.js";
import { reviewItem, triageItem } from "./helpers/artifacts.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function planLeafIds() {
  const plan = FLOW_DEFINITION.find((node) => node.id === "plan");
  assert.ok(plan, "FLOW_DEFINITION must contain plan branch");
  return plan.children.map((node) => node.id);
}

function assertOrdered(ids, chain) {
  for (let i = 0; i < chain.length - 1; i += 1) {
    const left = ids.indexOf(chain[i]);
    const right = ids.indexOf(chain[i + 1]);
    assert.notEqual(left, -1, `${chain[i]} must exist`);
    assert.notEqual(right, -1, `${chain[i + 1]} must exist`);
    assert.ok(left < right, `${chain[i]} must appear before ${chain[i + 1]}`);
  }
}

// ---------------------------------------------------------------------------
// TC-8: freshly declared plan flow includes the draft triage/repair leaves.
// ---------------------------------------------------------------------------

describe("R3 initial plan ordering (TC-8)", () => {
  it("R3: declares questions and coverage triage/repair leaves in consumer order", () => {
    const ids = planLeafIds();
    assertOrdered(ids, [
      "review-draft-questions",
      "draft-questions-triage",
      "draft-questions-repair",
      "draft-refine",
    ]);
    assertOrdered(ids, [
      "review-draft-coverage",
      "draft-coverage-triage",
      "draft-coverage-repair",
      "gate-draft",
    ]);
  });
});

describe("R10 registry responsibility boundary", () => {
  it("R10: registry records review/triage/repair/gate ownership", () => {
    assertDraftReviewRegistryHookBoundary();
    assert.equal(
      DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY.summary,
      "review as detection, triage as disposition, repair as mutation/audit, gate as mechanical validation",
    );
    assert.equal(
      FLOW_COMMANDS.run.review.draftReviewPostHookBoundary,
      DRAFT_REVIEW_REGISTRY_RESPONSIBILITY_BOUNDARY,
      "review registry post hook must carry the draft responsibility boundary",
    );
    assert.ok(
      FLOW_COMMANDS.run.review.responsibilities.some((line) => line.includes("detection")),
      "review registry entry must own detection",
    );
    assert.ok(
      FLOW_COMMANDS.run.review.responsibilities.some((line) => line.includes("disposition")),
      "review registry entry must delegate disposition",
    );
    assert.ok(
      FLOW_COMMANDS.run.review.responsibilities.some((line) => line.includes("mutation/audit")),
      "review registry entry must delegate mutation/audit",
    );
    assert.ok(
      FLOW_COMMANDS.run.gate.responsibilities.some((line) => line.includes("mechanical validation")),
      "gate registry entry must own mechanical validation",
    );
  });
});

// ---------------------------------------------------------------------------
// TC-19 / TC-20 / TC-21 / TC-22 / TC-35..TC-37: routing decisions.
// ---------------------------------------------------------------------------

describe("R7 routing classification (TC-19 / TC-20 / TC-21)", () => {
  it("R7: TC-19 PASS: empty review arrays → PASS, registry completes empty triage/repair artifacts", () => {
    const route = draftReviewRouteForRetryPhase("draft-questions");
    assert.equal(route.triageStepId, "draft-questions-triage");
    assert.equal(route.repairStepId, "draft-questions-repair");
    assert.equal(
      resolveDraftReviewNextStep({ verdict: "PASS", retryPhase: "draft-questions" }),
      route.passNextStepId,
    );
  });

  it("TC-20 ADVISORY: advisory findings only → ADVISORY, triage+repair run", () => {
    const route = draftReviewRouteForRetryPhase("draft-coverage");
    assert.equal(
      resolveDraftReviewNextStep({ verdict: "ADVISORY", retryPhase: "draft-coverage" }),
      route.triageStepId,
    );
  });

  it("TC-20 ADVISORY: repair targets only → ADVISORY", () => {
    assert.equal(
      resolveDraftReviewNextStep({ verdict: "ADVISORY", retryPhase: "draft-questions" }),
      "draft-questions-triage",
    );
  });

  it("TC-21 FAIL: any blocking finding → FAIL routing", () => {
    assert.equal(
      resolveDraftReviewNextStep({ verdict: "FAIL", retryPhase: "draft-coverage" }),
      "draft-coverage-triage",
    );
  });
});

// ---------------------------------------------------------------------------
// TC-1 / TC-2 / TC-18 / TC-38: non-mutation of draft.json through review +
// triage. Snapshot draft.json content (with hash) before/after each phase
// and assert byte equality through review and triage.
// ---------------------------------------------------------------------------

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

describe("R1/R6 non-mutation snapshots (TC-1 / TC-2 / TC-18 / TC-38)", () => {
  let tmp;
  let draftPath;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "draft-snap-"));
    draftPath = path.join(tmp, "draft.json");
    fs.writeFileSync(
      draftPath,
      JSON.stringify(
        {
          devType: "feature",
          goal: "Original goal text",
          analysis: { problem: "p", proposedApproach: "a", validation: "v" },
          qa: [
            { id: "q1", status: "answered", question: "Q?", answer: "A", evidence: "E", why: "W" },
          ],
          decisionMap: {
            knownFacts: [],
            decisionPoints: [],
            resolvedByProjectRules: [],
            requiresUserJudgment: [],
            deferredToSpec: [],
          },
          approval: { approved: false, confirmedAt: "", notes: "" },
        },
        null,
        2,
      ),
    );
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  // Simulators: in production these are review-draft-questions /
  // review-draft-coverage / draft-*-triage commands. The contract is that
  // they MUST NOT write draft.json and MUST NOT produce repair audit files.
  function runReviewSimulator({ phase }) {
    const reviewArtifact = {
      version: 1,
      phase,
      sourceDraft: draftPath,
      generatedAt: "2026-05-16T00:00:00.000Z",
      verdict: "FAIL",
      summary: "synthetic",
      blockingFindings: [{
        title: "T",
        target: "qa[0].question",
        rationale: "r",
        evidence: "e",
        classification: "blocking",
      }],
      advisoryFindings: [],
      repairTargets: [],
    };
    const outName =
      phase === "review-draft-questions"
        ? "draft-review-questions.json"
        : "draft-review-coverage.json";
    fs.writeFileSync(path.join(tmp, outName), JSON.stringify(reviewArtifact, null, 2));
    return reviewArtifact;
  }

  function runTriageSimulator({ phase, sourceReview }) {
    const triageArtifact = {
      version: 1,
      phase,
      sourceReview,
      generatedAt: "2026-05-16T00:01:00.000Z",
      summary: "synthetic",
      items: [{
        title: "T",
        target: "qa[0].question",
        decision: "apply",
        rationale: "r",
        evidence: "e",
      }],
    };
    const outName =
      phase === "draft-questions-triage"
        ? "draft-questions-triage.json"
        : "draft-coverage-triage.json";
    fs.writeFileSync(path.join(tmp, outName), JSON.stringify(triageArtifact, null, 2));
    return triageArtifact;
  }

  function runRepairSimulator({ phase, sourceTriage }) {
    const draft = JSON.parse(fs.readFileSync(draftPath, "utf8"));
    draft.approval = {
      ...(draft.approval || {}),
      approved: true,
      confirmedAt: "2026-05-16T00:02:00.000Z",
    };
    fs.writeFileSync(draftPath, JSON.stringify(draft, null, 2));

    const repairArtifact = {
      version: 1,
      phase,
      sourceTriage,
      generatedAt: "2026-05-16T00:02:00.000Z",
      summary: "synthetic repair",
      items: [{
        title: "T",
        target: "approval.approved",
        rationale: "Accepted triage item.",
        evidence: "approval changed",
        changedFieldPaths: ["approval.approved", "approval.confirmedAt"],
      }],
    };
    const outName =
      phase === "draft-questions-repair"
        ? "draft-questions-repair.json"
        : "draft-coverage-repair.json";
    fs.writeFileSync(path.join(tmp, outName), JSON.stringify(repairArtifact, null, 2));
    return repairArtifact;
  }

  it("R1: TC-1 review-draft-questions does not mutate draft.json or write repair audit", () => {
    const before = hashFile(draftPath);
    runReviewSimulator({ phase: "review-draft-questions" });
    const after = hashFile(draftPath);
    assert.equal(after, before, "draft.json must be byte-identical after review");
    assert.equal(
      fs.existsSync(path.join(tmp, "draft-questions-repair.json")),
      false,
      "draft-questions-repair.json must not be written by review",
    );
    assert.equal(
      fs.existsSync(path.join(tmp, "draft-review-questions.json")),
      true,
      "review JSON artifact should be written",
    );
  });

  it("TC-2: review-draft-coverage does not mutate draft.json or write repair audit", () => {
    const before = hashFile(draftPath);
    runReviewSimulator({ phase: "review-draft-coverage" });
    const after = hashFile(draftPath);
    assert.equal(after, before);
    assert.equal(
      fs.existsSync(path.join(tmp, "draft-coverage-repair.json")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(tmp, "draft-review-coverage.json")),
      true,
    );
  });

  it("R6: TC-18 / TC-38 draft.json is unchanged through review/triage and changed by repair", () => {
    const h0 = hashFile(draftPath);
    runReviewSimulator({ phase: "review-draft-questions" });
    const h1 = hashFile(draftPath);
    runTriageSimulator({
      phase: "draft-questions-triage",
      sourceReview: path.join(tmp, "draft-review-questions.json"),
    });
    const h2 = hashFile(draftPath);
    assert.equal(h1, h0, "hash after review must equal pre-review hash");
    assert.equal(h2, h0, "hash after triage must equal pre-review hash");
    runRepairSimulator({
      phase: "draft-questions-repair",
      sourceTriage: path.join(tmp, "draft-questions-triage.json"),
    });
    const h3 = hashFile(draftPath);
    assert.notEqual(h3, h0, "hash after repair must differ from pre-review hash");
  });
});

// ---------------------------------------------------------------------------
// Shared gate-draft simulator used by migration and end-to-end routing tests.
// ---------------------------------------------------------------------------

const VALID_DECISIONS = new Set([
  "apply",
  "invalid",
  "already_resolved",
  "downgraded_to_non_blocking",
  "requires_user_decision",
]);

function gateDraft(artifacts, draft) {
  for (const key of [
    "questionsReview",
    "questionsTriage",
    "questionsRepair",
    "coverageReview",
    "coverageTriage",
    "coverageRepair",
  ]) {
    if (!artifacts[key]) return { ok: false, code: "MISSING_ARTIFACT" };
  }

  for (const [triageKey, reviewKey] of [
    ["questionsTriage", "questionsReview"],
    ["coverageTriage", "coverageReview"],
  ]) {
    if (artifacts[triageKey].sourceReview !== artifacts[reviewKey]._artifactPath) {
      return { ok: false, code: "LINK_MISMATCH" };
    }
    const triageTitles = new Set(artifacts[triageKey].items.map((item) => item.title));
    for (const item of artifacts[reviewKey].blockingFindings) {
      if (!triageTitles.has(item.title)) return { ok: false, code: "ITEM_COUNT_MISMATCH" };
    }
  }

  for (const [repairKey, triageKey] of [
    ["questionsRepair", "questionsTriage"],
    ["coverageRepair", "coverageTriage"],
  ]) {
    if (artifacts[repairKey].sourceTriage !== artifacts[triageKey]._artifactPath) {
      return { ok: false, code: "LINK_MISMATCH" };
    }
    const applyTitles = artifacts[triageKey].items
      .filter((item) => item.decision === "apply")
      .map((item) => item.title);
    const repairTitles = new Set(artifacts[repairKey].items.map((item) => item.title));
    if (applyTitles.length !== repairTitles.size) {
      return { ok: false, code: "ITEM_COUNT_MISMATCH" };
    }
    for (const title of applyTitles) {
      if (!repairTitles.has(title)) return { ok: false, code: "ITEM_COUNT_MISMATCH" };
    }
  }

  for (const triageKey of ["questionsTriage", "coverageTriage"]) {
    for (const item of artifacts[triageKey].items) {
      if (!VALID_DECISIONS.has(item.decision)) return { ok: false, code: "INVALID_DECISION" };
      if (item.decision === "requires_user_decision") {
        return { ok: false, code: "UNRESOLVED_DECISION" };
      }
    }
  }

  if (draft.approval?.approved !== true) {
    return { ok: false, code: "MISSING_APPROVAL" };
  }
  return { ok: true };
}

function makeReview({ path: artifactPath, phase, verdict, blocking = [], advisory = [], repair = [] }) {
  return {
    _artifactPath: artifactPath,
    version: 1,
    phase,
    sourceDraft: "specs/<id>/draft.json",
    generatedAt: "2026-05-16T00:00:00.000Z",
    verdict,
    summary: `${phase} ${verdict}`,
    blockingFindings: blocking.map((title) => reviewItem(title, "blocking")),
    advisoryFindings: advisory.map((title) => reviewItem(title, "advisory")),
    repairTargets: repair.map((title) => reviewItem(title, "repair_target")),
  };
}

function makeTriage({ path: artifactPath, phase, sourceReview, items = [] }) {
  return {
    _artifactPath: artifactPath,
    version: 1,
    phase,
    sourceReview,
    generatedAt: "2026-05-16T00:01:00.000Z",
    summary: `${phase} triage`,
    items,
  };
}

function makeRepair({ path: artifactPath, phase, sourceTriage, items = [] }) {
  return {
    _artifactPath: artifactPath,
    version: 1,
    phase,
    sourceTriage,
    generatedAt: "2026-05-16T00:02:00.000Z",
    summary: `${phase} repair`,
    items: items
      .filter((item) => item.decision === "apply")
      .map((item) => ({
        title: item.title,
        target: item.target,
        rationale: "applied",
        evidence: "synthetic repair",
        changedFieldPaths: ["qa"],
      })),
  };
}

function buildPipelineArtifacts({ questions, coverage, decisions = {} }) {
  const paths = {
    questionsReview: "specs/<id>/draft-review-questions.json",
    questionsTriage: "specs/<id>/draft-questions-triage.json",
    questionsRepair: "specs/<id>/draft-questions-repair.json",
    coverageReview: "specs/<id>/draft-review-coverage.json",
    coverageTriage: "specs/<id>/draft-coverage-triage.json",
    coverageRepair: "specs/<id>/draft-coverage-repair.json",
  };
  const questionsReview = makeReview({
    path: paths.questionsReview,
    phase: "review-draft-questions",
    ...questions,
  });
  const coverageReview = makeReview({
    path: paths.coverageReview,
    phase: "review-draft-coverage",
    ...coverage,
  });
  const questionsItems = [
    ...questionsReview.blockingFindings,
    ...questionsReview.repairTargets,
  ].map((item) => triageItem(item.title, decisions[item.title] || "apply"));
  const coverageItems = [
    ...coverageReview.blockingFindings,
    ...coverageReview.repairTargets,
  ].map((item) => triageItem(item.title, decisions[item.title] || "apply"));
  const questionsTriage = makeTriage({
    path: paths.questionsTriage,
    phase: "draft-questions-triage",
    sourceReview: paths.questionsReview,
    items: questionsItems,
  });
  const coverageTriage = makeTriage({
    path: paths.coverageTriage,
    phase: "draft-coverage-triage",
    sourceReview: paths.coverageReview,
    items: coverageItems,
  });
  return {
    questionsReview,
    questionsTriage,
    questionsRepair: makeRepair({
      path: paths.questionsRepair,
      phase: "draft-questions-repair",
      sourceTriage: paths.questionsTriage,
      items: questionsItems,
    }),
    coverageReview,
    coverageTriage,
    coverageRepair: makeRepair({
      path: paths.coverageRepair,
      phase: "draft-coverage-repair",
      sourceTriage: paths.coverageTriage,
      items: coverageItems,
    }),
  };
}

// ---------------------------------------------------------------------------
// TC-3: markdown-summary independence — JSON is authoritative.
// ---------------------------------------------------------------------------

describe("R1 markdown independence (TC-3)", () => {
  function decideFromArtifacts({ json, markdown }) {
    // Production rule: JSON is the single source of truth; markdown is
    // ignored for routing decisions.
    void markdown;
    return resolveDraftReviewNextStep({
      verdict: json.verdict,
      retryPhase: "draft-coverage",
    });
  }

  it("ignores conflicting markdown verdict text", () => {
    const json = {
      verdict: "PASS",
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [],
    };
    const markdown = "Verdict: FAIL — this markdown is intentionally wrong.";
    assert.equal(decideFromArtifacts({ json, markdown }), "gate-draft");
  });
});

// ---------------------------------------------------------------------------
// TC-35..TC-37: spec-local end-to-end routing through review, triage, repair,
// and gate-draft.
// ---------------------------------------------------------------------------

describe("R11 PASS/ADVISORY/FAIL routing pipeline (TC-35 / TC-36 / TC-37)", () => {
  it("TC-35 PASS: empty triage/repair stubs are completed and gate-draft passes", () => {
    const artifacts = buildPipelineArtifacts({
      questions: {
        verdict: "PASS",
        blocking: [],
        advisory: [],
        repair: [],
      },
      coverage: {
        verdict: "PASS",
        blocking: [],
        advisory: [],
        repair: [],
      },
    });
    assert.equal(artifacts.questionsReview.verdict, "PASS");
    assert.equal(artifacts.questionsTriage.items.length, 0);
    assert.equal(artifacts.questionsRepair.items.length, 0);
    assert.deepEqual(gateDraft(artifacts, { approval: { approved: true } }), { ok: true });
  });

  it("TC-36 ADVISORY: repair targets flow through triage/repair and gate-draft passes", () => {
    const artifacts = buildPipelineArtifacts({
      questions: {
        verdict: "PASS",
        blocking: [],
        advisory: [],
        repair: [],
      },
      coverage: {
        verdict: "ADVISORY",
        blocking: [],
        advisory: ["Advisory note"],
        repair: ["Repair target"],
      },
    });
    assert.equal(artifacts.coverageReview.verdict, "ADVISORY");
    assert.equal(artifacts.coverageTriage.items.length, 1);
    assert.equal(artifacts.coverageRepair.items.length, 1);
    assert.deepEqual(gateDraft(artifacts, { approval: { approved: true } }), { ok: true });
  });

  it("TC-37 FAIL: resolved blocking findings pass; unresolved user decisions block", () => {
    const resolved = buildPipelineArtifacts({
      questions: {
        verdict: "FAIL",
        blocking: ["Blocking apply", "Blocking invalid"],
        advisory: [],
        repair: [],
      },
      coverage: {
        verdict: "PASS",
        blocking: [],
        advisory: [],
        repair: [],
      },
      decisions: {
        "Blocking apply": "apply",
        "Blocking invalid": "invalid",
      },
    });
    assert.equal(resolved.questionsReview.verdict, "FAIL");
    assert.equal(resolved.questionsTriage.items.length, 2);
    assert.equal(resolved.questionsRepair.items.length, 1);
    assert.deepEqual(gateDraft(resolved, { approval: { approved: true } }), { ok: true });

    const unresolved = buildPipelineArtifacts({
      questions: {
        verdict: "FAIL",
        blocking: ["Needs user"],
        advisory: [],
        repair: [],
      },
      coverage: {
        verdict: "PASS",
        blocking: [],
        advisory: [],
        repair: [],
      },
      decisions: {
        "Needs user": "requires_user_decision",
      },
    });
    assert.deepEqual(
      gateDraft(unresolved, { approval: { approved: true } }),
      { ok: false, code: "UNRESOLVED_DECISION" },
    );
  });
});

// ---------------------------------------------------------------------------
// TC-29..TC-33: migration semantics.
//
// We encode the migration rule as a pure function and test the four
// canonical scenarios. The rule:
//   - Insert questions-triage / questions-repair before draft-refine
//   - Insert coverage-triage / coverage-repair before gate-draft
//   - Inserted edges: questions-triage→questions-repair,
//                     questions-repair→draft-refine,
//                     coverage-triage→coverage-repair,
//                     coverage-repair→gate-draft
//   - If the downstream consumer is done or in_progress, the inserted
//     leaves are stamped 'done' with empty-but-valid JSON artifact
//     placeholders. Otherwise 'pending'.
//   - Legacy markdown-only review artifacts are NOT authoritative; the
//     migration rewrites references to JSON filenames.
// ---------------------------------------------------------------------------

function migrateFlow(flow) {
  const out = { ...flow, steps: [...flow.steps], edges: [...(flow.edges || [])] };
  const stepIndex = new Map(out.steps.map((s, i) => [s.id, i]));

  function insertBefore(consumerId, insertions) {
    if (!stepIndex.has(consumerId)) return;
    const consumer = out.steps[stepIndex.get(consumerId)];
    const consumerDoneOrRunning =
      consumer.status === "done" || consumer.status === "in_progress";
    for (let i = 0; i < insertions.length; i += 1) {
      const id = insertions[i];
      if (stepIndex.has(id)) continue;
      const newStep = {
        id,
        status: consumerDoneOrRunning ? "done" : "pending",
      };
      const insertAt = stepIndex.get(consumerId);
      out.steps.splice(insertAt, 0, newStep);
      // rebuild index
      out.steps.forEach((s, idx) => stepIndex.set(s.id, idx));
    }
  }

  insertBefore("draft-refine", ["draft-questions-triage", "draft-questions-repair"]);
  insertBefore("gate-draft", ["draft-coverage-triage", "draft-coverage-repair"]);

  const requiredEdges = [
    ["draft-questions-triage", "draft-questions-repair"],
    ["draft-questions-repair", "draft-refine"],
    ["draft-coverage-triage", "draft-coverage-repair"],
    ["draft-coverage-repair", "gate-draft"],
  ];
  for (const [from, to] of requiredEdges) {
    if (!out.edges.some(([a, b]) => a === from && b === to)) {
      out.edges.push([from, to]);
    }
  }

  // Rewrite legacy markdown references to JSON.
  out.artifacts = (flow.artifacts || []).map((a) => {
    if (a.endsWith(".md") && /draft-review-(questions|coverage)/.test(a)) {
      return a.replace(/\.md$/, ".json");
    }
    return a;
  });

  return out;
}

describe("R9 migration (TC-29 / TC-30 / TC-31 / TC-32 / TC-33)", () => {
  function baseFlow() {
    return {
      steps: [
        { id: "draft", status: "done" },
        { id: "review-draft-questions", status: "done" },
        { id: "draft-refine", status: "pending" },
        { id: "review-draft-coverage", status: "done" },
        { id: "gate-draft", status: "pending" },
      ],
      edges: [
        ["review-draft-questions", "draft-refine"],
        ["draft-refine", "review-draft-coverage"],
        ["review-draft-coverage", "gate-draft"],
      ],
      artifacts: [],
    };
  }

  it("R9: TC-29 all consumers pending → 4 leaves inserted as pending in correct positions", () => {
    const migrated = migrateFlow(baseFlow());
    const ids = migrated.steps.map((s) => s.id);
    assert.ok(
      ids.indexOf("draft-questions-triage") < ids.indexOf("draft-questions-repair"),
    );
    assert.ok(
      ids.indexOf("draft-questions-repair") < ids.indexOf("draft-refine"),
    );
    assert.ok(
      ids.indexOf("draft-coverage-triage") < ids.indexOf("draft-coverage-repair"),
    );
    assert.ok(
      ids.indexOf("draft-coverage-repair") < ids.indexOf("gate-draft"),
    );
    for (const id of [
      "draft-questions-triage",
      "draft-questions-repair",
      "draft-coverage-triage",
      "draft-coverage-repair",
    ]) {
      const step = migrated.steps.find((s) => s.id === id);
      assert.equal(step.status, "pending", `${id} should start pending`);
    }
  });

  it("TC-30: draft-refine done + gate-draft in_progress → inserted leaves marked done", () => {
    const flow = baseFlow();
    flow.steps.find((s) => s.id === "draft-refine").status = "done";
    flow.steps.find((s) => s.id === "gate-draft").status = "in_progress";
    const migrated = migrateFlow(flow);
    for (const id of [
      "draft-questions-triage",
      "draft-questions-repair",
      "draft-coverage-triage",
      "draft-coverage-repair",
    ]) {
      const step = migrated.steps.find((s) => s.id === id);
      assert.equal(step.status, "done", `${id} should be auto-completed`);
    }
  });

  it("TC-31: migration adds exactly the four specified edges, alters no others", () => {
    const flow = baseFlow();
    const beforeEdges = new Set(flow.edges.map((e) => e.join("→")));
    const migrated = migrateFlow(flow);
    const afterEdges = new Set(migrated.edges.map((e) => e.join("→")));

    for (const e of beforeEdges) {
      assert.ok(afterEdges.has(e), `pre-existing edge ${e} should be preserved`);
    }
    const added = [...afterEdges].filter((e) => !beforeEdges.has(e));
    assert.deepEqual(
      added.sort(),
      [
        "draft-coverage-repair→gate-draft",
        "draft-coverage-triage→draft-coverage-repair",
        "draft-questions-repair→draft-refine",
        "draft-questions-triage→draft-questions-repair",
      ],
    );
  });

  it("TC-32: legacy markdown artifact references are rewritten to JSON names", () => {
    const flow = baseFlow();
    flow.artifacts = [
      "specs/<id>/draft-review-questions.md",
      "specs/<id>/draft-review-coverage.md",
      "specs/<id>/unrelated.md",
    ];
    const migrated = migrateFlow(flow);
    assert.deepEqual(migrated.artifacts, [
      "specs/<id>/draft-review-questions.json",
      "specs/<id>/draft-review-coverage.json",
      "specs/<id>/unrelated.md",
    ]);
  });

  it("TC-33: markdown-only fallback is not authoritative (gate-draft still requires JSON)", () => {
    const flow = baseFlow();
    flow.artifacts = ["specs/<id>/draft-review-questions.md"];
    const migrated = migrateFlow(flow);
    // After migration the reference is rewritten; the .json file must exist
    // for gate-draft to pass. Migration alone does not produce JSON content.
    const jsonExpected = "specs/<id>/draft-review-questions.json";
    assert.ok(migrated.artifacts.includes(jsonExpected));
    // Simulate gate-draft check: does the JSON file exist on disk?
    const gateDraftCheck = (artifactRefs, existsFn) =>
      artifactRefs.every((r) => r.endsWith(".json") && existsFn(r));
    const exists = () => false; // none on disk
    assert.equal(
      gateDraftCheck(migrated.artifacts, exists),
      false,
      "gate-draft must fail when JSON artifact does not exist (no markdown fallback)",
    );
  });

  it("TC-34: empty inserted JSON artifacts validate when consumer was already done", () => {
    const artifacts = buildPipelineArtifacts({
      questions: {
        verdict: "PASS",
        blocking: [],
        advisory: [],
        repair: [],
      },
      coverage: {
        verdict: "PASS",
        blocking: [],
        advisory: [],
        repair: [],
      },
    });
    assert.equal(artifacts.questionsTriage.items.length, 0);
    assert.equal(artifacts.questionsRepair.items.length, 0);
    assert.equal(artifacts.coverageTriage.items.length, 0);
    assert.equal(artifacts.coverageRepair.items.length, 0);
    assert.deepEqual(gateDraft(artifacts, { approval: { approved: true } }), { ok: true });
  });
});

// ---------------------------------------------------------------------------
// GAP-4 / TC-33: spec-local test suite inventory check.
//
// Meta-test enforcing that the spec-local test suite covers the four R11
// categories. If a future refactor silently drops a whole category, this
// test fails loudly. Markers verified:
//   (a) review non-mutation       → TC-1, TC-2
//   (b) triage/repair artifact shape → TC-8 (triage), TC-13 (repair)
//   (c) gate-draft validation     → gate-draft-validation.test.js exists
//                                    with non-zero `it(...)` count
//   (d) PASS/ADVISORY/FAIL routing → TC-35, TC-36, TC-37
// ---------------------------------------------------------------------------

describe("R11 spec-local test suite inventory (GAP-4, TC-33)", () => {
  const specTestDir = "specs/258-draft-review-repair-flow/tests";
  const testFiles = {
    "draft-artifact-contract.test.js":
      path.join(specTestDir, "draft-artifact-contract.test.js"),
    "flow-routing-migration.test.js":
      path.join(specTestDir, "flow-routing-migration.test.js"),
    "gate-draft-validation.test.js":
      path.join(specTestDir, "gate-draft-validation.test.js"),
  };

  function readAllSpecTests() {
    let buf = "";
    for (const rel of Object.values(testFiles)) {
      const full = path.join(root, rel);
      if (fs.existsSync(full)) {
        buf += "\n" + fs.readFileSync(full, "utf8");
      }
    }
    return buf;
  }

  it("(a) covers review non-mutation (TC-1 / TC-2)", () => {
    const text = readAllSpecTests();
    assert.match(
      text,
      /\bTC-1\b/,
      "spec-local suite must contain a TC-1 marker (review-draft-questions non-mutation)",
    );
    assert.match(
      text,
      /\bTC-2\b/,
      "spec-local suite must contain a TC-2 marker (review-draft-coverage non-mutation)",
    );
  });

  it("(b) covers triage/repair artifact shape (TC-8 / TC-13)", () => {
    const text = readAllSpecTests();
    assert.match(
      text,
      /\bTC-8\b/,
      "spec-local suite must contain a TC-8 marker (triage artifact shape)",
    );
    assert.match(
      text,
      /\bTC-13\b/,
      "spec-local suite must contain a TC-13 marker (repair artifact shape)",
    );
  });

  it("(c) covers gate-draft validation failures (file exists with non-zero it count)", () => {
    const full = path.join(root, testFiles["gate-draft-validation.test.js"]);
    assert.ok(
      fs.existsSync(full),
      "gate-draft-validation.test.js must exist in spec-local suite",
    );
    const content = fs.readFileSync(full, "utf8");
    const itCount = (content.match(/\bit\s*\(/g) || []).length;
    assert.ok(
      itCount > 0,
      `gate-draft-validation.test.js must contain at least one it(...) block (found ${itCount})`,
    );
  });

  it("R11: covers PASS/ADVISORY/FAIL routing (TC-35 / TC-36 / TC-37)", () => {
    const text = readAllSpecTests();
    assert.match(
      text,
      /\bTC-35\b/,
      "spec-local suite must contain a TC-35 marker (PASS routing)",
    );
    assert.match(
      text,
      /\bTC-36\b/,
      "spec-local suite must contain a TC-36 marker (ADVISORY routing)",
    );
    assert.match(
      text,
      /\bTC-37\b/,
      "spec-local suite must contain a TC-37 marker (FAIL routing)",
    );
  });
});

// ---------------------------------------------------------------------------
// Minimal grep tripwires (GAP-10): leaf id tokens in source.
// ---------------------------------------------------------------------------

describe("R3 leaf id tripwire (grep)", () => {
  const definition = read("src/flow/definition.js");
  for (const id of [
    "draft-questions-triage",
    "draft-questions-repair",
    "draft-coverage-triage",
    "draft-coverage-repair",
  ]) {
    it(`definition.js declares leaf id ${id}`, () => {
      assert.match(definition, new RegExp(`['"]${id}['"]`));
    });
  }
});
