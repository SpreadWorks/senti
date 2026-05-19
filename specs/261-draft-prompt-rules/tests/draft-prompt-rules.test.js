// spec: R1 R2 R3 R4 R5 R6 R7 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { getStepInstructions } from "../../../src/flow/lib/get-step-instructions.js";
import { checkDraftJson } from "../../../src/flow/lib/run-gate.js";
import { buildDraftReviewPrompt } from "../../../src/flow/commands/review.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const PARTIAL_PATH = path.join(ROOT, "src/flow/prompts/partials/draft-qa-rules.md");
const DRAFT_PROMPT_PATH = path.join(ROOT, "src/flow/prompts/plan/draft.md");

function coverageDraft(considered = "Using a shared partial was selected over duplicate prompt text.") {
  return {
    qa: [
      {
        id: "q1",
        status: "answered",
        category: "acceptance-criteria",
        question: "Which source owns draft QA rules?",
        answer: "The shared partial owns draft QA rules.",
        evidence: "src/flow/prompts/partials/draft-qa-rules.md",
        why: "Authoring and review must share one rule source.",
        considered,
        droppedReason: "",
      },
    ],
    decisionMap: {
      knownFacts: [],
      decisionPoints: [],
      resolvedByProjectRules: [],
      requiresUserJudgment: [],
      deferredToSpec: [],
    },
  };
}

function validDraftWithConsidered() {
  return {
    devType: "feature",
    goal: "share draft QA rules",
    analysis: {
      problem: "draft QA rules are duplicated",
      proposedApproach: "use one shared partial and align runtime contract",
      validation: "the prompt and validator will share the same QA fields",
    },
    decisionMap: {
      knownFacts: ["draft QA rules are prompt and review inputs"],
      decisionPoints: ["where considered is stored"],
      resolvedByProjectRules: ["use existing include resolver"],
      requiresUserJudgment: [],
      deferredToSpec: [],
    },
    scopeVerification: { in: ["shared partial"], out: [] },
    impactOnExisting: ["draft prompt", "draft review prompt"],
    qa: [
      {
        id: "q1",
        status: "answered",
        category: "acceptance-criteria",
        question: "Should considered be part of the runtime contract?",
        answer: "Yes, the runtime contract stores considered.",
        evidence: "src/flow/lib/draft-lifecycle.js",
        why: "The validator and prompt schema must match.",
        considered: "Prompt-only considered was rejected because the gate would not validate the same schema.",
        droppedReason: "",
      },
    ],
    openQuestions: [],
    approval: { approved: true, confirmedAt: "2026-05-19", notes: "" },
  };
}

test("R1: shared draft QA rules partial declares the common contract", () => {
  const content = fs.readFileSync(PARTIAL_PATH, "utf8");

  assert.match(content, /## Draft QA Rules/);
  assert.match(content, /QA entry schema/);
  assert.match(content, /considered/);
  assert.match(content, /Field-level boundary/);
  assert.match(content, /Requirements category checklist/);
  assert.match(content, /Premise validation/);
  assert.equal((content.match(/^\d+\. /gm) || []).length, 8);
  assert.match(content, /Decision entry rule/);
  assert.match(content, /evidence/);
  assert.match(content, /Coverage rule/);
});

test("R2: getStepInstructions expands includes and reports missing include paths", () => {
  const content = getStepInstructions("plan.draft");
  assert.match(content, /## Draft QA Rules/);
  assert.doesNotMatch(content, /<!--\s*include\("/);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-forge-include-"));
  const promptDir = path.join(tmp, "plan");
  fs.mkdirSync(promptDir, { recursive: true });

  fs.writeFileSync(path.join(promptDir, "partial.md"), "relative include ok\n");
  fs.writeFileSync(
    path.join(promptDir, "draft.md"),
    [
      "<!-- include(\"partial.md\") -->",
      "<!-- include(\"/lib/include.js\") -->",
      "",
    ].join("\n"),
  );

  const previous = process.env.SDD_FORGE_NEXT_ACTION_PROMPTS_DIR;
  process.env.SDD_FORGE_NEXT_ACTION_PROMPTS_DIR = tmp;
  try {
    const resolved = getStepInstructions("plan.draft");
    assert.match(resolved, /relative include ok/);
    assert.match(resolved, /MAX_INCLUDE_DEPTH/);

    fs.writeFileSync(
      path.join(promptDir, "draft.md"),
      "<!-- include(\"missing-partial.md\") -->\n",
    );
    assert.throws(
      () => getStepInstructions("plan.draft"),
      /missing-partial\.md/,
    );

    for (let i = 0; i < 10; i++) {
      fs.writeFileSync(
        path.join(promptDir, `depth-${i}.md`),
        i === 9 ? "bottom\n" : `<!-- include(\"depth-${i + 1}.md\") -->\n`,
      );
    }
    fs.writeFileSync(path.join(promptDir, "draft.md"), "<!-- include(\"depth-0.md\") -->\n");
    assert.throws(
      () => getStepInstructions("plan.draft"),
      /Include recursion depth exceeded 8 levels/,
    );

    fs.writeFileSync(path.join(promptDir, "one.md"), "one\n");
    fs.writeFileSync(
      path.join(promptDir, "draft.md"),
      Array.from({ length: 33 }, () => "<!-- include(\"one.md\") -->").join("\n"),
    );
    assert.throws(
      () => getStepInstructions("plan.draft"),
      /Total include count exceeded 32/,
    );
  } finally {
    if (previous === undefined) delete process.env.SDD_FORGE_NEXT_ACTION_PROMPTS_DIR;
    else process.env.SDD_FORGE_NEXT_ACTION_PROMPTS_DIR = previous;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R3: draft prompt includes shared rules once, removes duplicate rules, and keeps authoring controls", () => {
  const raw = fs.readFileSync(DRAFT_PROMPT_PATH, "utf8");
  const includeMatches = raw.match(/include\("\/flow\/prompts\/partials\/draft-qa-rules\.md"\)/g) || [];

  assert.equal(includeMatches.length, 1);
  assert.doesNotMatch(raw, /Draft scope boundary/);
  assert.equal((raw.match(/Requirements category checklist/g) || []).length, 0);
  assert.doesNotMatch(raw, /\*\*draft\.json schema:\*\*/);
  assert.doesNotMatch(raw, /Premise validation/);
  assert.doesNotMatch(raw, /Research.*self-verification.*question generation/);
  assert.doesNotMatch(raw, /Code references within the `evidence`, `why`, and `answer` fields/);

  assert.match(raw, /autoApprove mode .* autonomous question-list draft/);
  assert.match(raw, /Communication rules for the draft phase/);
  assert.match(raw, /On complete/);
});

test("R4: draft lifecycle accepts considered for answered entries and rejects unresolved considered", async () => {
  const prepareSpecModule = await import("../../../src/flow/lib/run-prepare-spec.js");
  assert.equal(typeof prepareSpecModule.buildDraftTemplate, "function");

  const draftSkeletonText = prepareSpecModule.buildDraftTemplate();
  const draftSkeleton = JSON.parse(draftSkeletonText);

  assert.ok(Array.isArray(draftSkeleton.qa));
  assert.match(draftSkeletonText, /"considered": ""/);
  for (const entry of draftSkeleton.qa) {
    assert.equal(entry.considered, "");
  }

  assert.deepEqual(checkDraftJson(validDraftWithConsidered()), []);

  for (const status of ["pending", "approved", "dropped"]) {
    const draft = validDraftWithConsidered();
    draft.qa[0] = {
      ...draft.qa[0],
      status,
      answer: "",
      evidence: "",
      why: "",
      considered: "This must not be populated yet.",
      droppedReason: status === "dropped" ? "No longer needed." : "",
    };

    const issues = checkDraftJson(draft);
    assert.ok(
      issues.some((issue) => new RegExp(`considered must be empty when status is ${status}`).test(issue)),
      `expected considered ${status} validation issue, got: ${issues.join("; ")}`,
    );
  }
});

test("R5: draft coverage review prompt loads shared rules and prints considered", () => {
  const prompt = buildDraftReviewPrompt(coverageDraft(), "request", [], { key: "coverage" });
  assert.match(prompt, /## Draft QA Rules/);
  assert.match(prompt, /\*\*Considered:\*\* Using a shared partial was selected/);

  const nonePrompt = buildDraftReviewPrompt(coverageDraft(""), "request", [], { key: "coverage" });
  assert.match(nonePrompt, /\*\*Considered:\*\* \(none\)/);
});

test("R6: question sanity review stays finite while coverage review gets shared rules", () => {
  const questionPrompt = buildDraftReviewPrompt({
    qa: [
      {
        id: "q1",
        status: "pending",
        category: "acceptance-criteria",
        question: "Which source owns draft QA rules?",
        answer: "",
        evidence: "",
        why: "",
        considered: "",
        droppedReason: "",
      },
    ],
  }, "request", [], { key: "questions" });
  const coveragePrompt = buildDraftReviewPrompt(coverageDraft(), "request", [], { key: "coverage" });

  assert.match(questionPrompt, /Do not identify missing first-pass questions/);
  assert.doesNotMatch(questionPrompt, /Requirements category checklist/);
  assert.match(coveragePrompt, /Requirements category checklist/);
});

test("R7: draft coverage review keeps existing markers and adds considered only as a QA field", () => {
  const prompt = buildDraftReviewPrompt(coverageDraft(), "request", [], { key: "coverage" });

  assert.match(prompt, /### 1\. <title>/);
  assert.match(prompt, /\*\*QA:\*\* q<N>/);
  assert.match(prompt, /\*\*Classification:\*\* blocking/);
  assert.match(prompt, /\*\*Blocking decision:\*\*/);
  assert.match(prompt, /NO_PROPOSALS/);
  assert.match(prompt, /\*\*Considered:\*\*/);
});

test("R8: regression coverage exercises include, lifecycle, prompt sharing, and review formatting contracts", () => {
  assert.match(getStepInstructions("plan.draft"), /## Draft QA Rules/);
  assert.deepEqual(checkDraftJson(validDraftWithConsidered()), []);
  assert.match(
    buildDraftReviewPrompt(coverageDraft(), "request", [], { key: "coverage" }),
    /\*\*Considered:\*\*/,
  );
});
