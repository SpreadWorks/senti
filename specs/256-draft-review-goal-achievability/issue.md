## Overview

Redefine the responsibility of draft review from **"a mechanism that evaluates the quality of the draft itself"** to **"a mechanism that improves the achievability of the goal"**. At the same time, **reinterpret the role of the draft phase as "source reading + full QA including implementation + premise organization"**.

Review is not a quality-check that judges the quality of the draft, but rather a **supplementation mechanism that evaluates whether the information necessary to achieve the issue/request goal is gathered through QA, and generates additional questions if there are gaps**. It does not have the function of negating user answers. When spec phase encounters an event that requires user confirmation, **consistency is maintained by returning to draft via the existing reopen-draft mechanism**.

Quality judgments (shallow / ambiguous / redundant) that review relinquishes are **transferred to gate-draft guardrails**.

Note: Since this board has a large scope, it is premised on being decomposed into appropriate granularity in subsequent steps.

## Background: Current Responsibility Overlap Problem

Current `buildDraftReviewPrompt` (src/flow/commands/review.js:1212-1248) Focus 4 items:

- shallow / generic questions (quality judgment)
- Missing coverage (gap detection)
- Ambiguous / unsupported answers (quality judgment)
- Redundant entries (quality judgment)

→ 3 out of 4 items are **quality judgments of existing QA**. This inherits the broader design of spec 242 (review supplements quality problems that gate cannot detect).

However, spec 246's Design Principles narrowed it to "draft review: AI detects gaps, but answers are obtained from users", yet the Focus 4 items were unchanged and preserved. **As a result, 2 design intents coexist within the prompt**.

Additionally, quality-check type review has the following structural problems:

- When review negates what the user answered, the user's effort is wasted
- Reviewer cites different quality problems each iteration, causing a loop (whack-a-mole)
- Having 4 evaluation axes causes large judgment drift

## Background: Design and Session Structure of draft/spec Separation

### Original Design (token efficiency priority)

- draft: Only asks "what do you want to build" (source unread, lightweight)
- spec: Source reading + organization + specification
- Main reason for boundary: Deep source reading in draft → double reading in spec → token pressure

### Implementation Facts (reconfirmed)

draft and spec content creation is **performed consecutively by the same session AI (= skill driver executing the flow)**:

- Calling external sessions via `agent.call()` is only for: **independent evaluation** purposes such as gate / review / auto-check / test series
- **Content creation (write)** of draft.json / spec.json is done directly by the session AI following the instructions from `flow get next-action`
- → Source read in draft phase typically remains in conversation history and can be referenced from the same context in spec phase = **unnecessary double-reading can be reduced**. However, conversation history is not a persistent store, so upon context compaction / resume / restart in a different session, necessary sections are re-read starting from draft artifact evidence

The reason external agents become separate sessions aligns with the user explanation: "Only for cases like review where context is actually a hindrance, route to independent evaluation."

### spec phase Source Re-reading Rule

spec phase treats `draft.json` as authoritative input rather than conversation memory. Source facts / decisions / evidence obtained in draft phase are saved to `draft.json.qa[].evidence`, `analysis`, `scopeVerification`, `impactOnExisting`.

Add the following English rule to the spec prompt:

```text
Use draft.json as the authoritative input for the spec.

If draft.json contains source evidence or implementation facts, use those entries as anchors. If the referenced source context is not present in the current conversation, or if you cannot verify the fact from the available context, re-read the referenced source before relying on it. Do not infer implementation facts from memory or from incomplete context.
```

This design reduces double-reading by utilizing the same session context in normal cases, and only re-reads necessary sections starting from evidence when context is lost.

### Reinterpretation in This Proposal

Based on the understanding of session structure, the role of draft can be freed from its original constraints:

- draft: **Investigation (source reading) + full QA including implementation decisions requiring user judgment + premise organization** (broader)
- spec: Continues in the same session, utilizing available context. However, treats `draft.json` as authoritative input, and re-reads from evidence when source context is lost
- The original constraint "keep draft lightweight to avoid double-reading" can be relaxed (normally double-reading can be reduced with the same session context, but evidence is re-read when context is lost)

This enables:
- Implementation policy QA requiring user judgment in draft is OK (e.g., Redis vs Memcached can be asked in draft)
- Aligns with the user's statement "it's natural to have implementation questions in draft"
- Affirms the direction of the current implementation (minimizes migration cost)
- The constraint "draft = lightweight" is organized as having been based on a misunderstanding of session structure

### Boundary of Implementation Policies Handled in Draft

This proposal allows "QA including implementation" in draft, but this is limited to **selection of implementation policies requiring user judgment**. It does not mean draft becomes a phase that finalizes internal implementation details.

Examples of what can be handled in draft:

- Judgments on external services / technology selection such as Redis vs Memcached
- Whether to extend an existing module or separate into a new module
- Whether to express as CLI option or config
- Whether to extend an existing flow step or add a new step
- Design choices dependent on user operational judgment or product policy

Examples of what should not be handled in draft:

- Control flow inside functions
- Detailed data structures
- Details of API signatures
- Implementation algorithm procedures
- Internal implementation details that AI can determine from source without requiring user judgment

Therefore, draft-scope-boundary is redefined as "selection of implementation policies is allowed, finalization of internal implementation details is delegated to spec / task phase." What is recorded in draft is the premises approved/selected by the user, and the evidence / rationale necessary for those judgments.

## Phase Role Definitions

| Phase | Purpose | Output | User Involvement | Source Investigation |
|---|---|---|---|---|
| draft | Confirm premises (goal / technology selection / scope / constraints) that need to be decided through dialogue with user | draft.json (qa[] + goal) | Required (auto-select [1] in autoApprove mode) | As needed |
| spec | AI organizes premises confirmed in draft into implementable specification documents | spec.json (requirements / acceptance / tasks) | None (return to draft via reopen-draft if needed) | Inherit draft context, additional investigation only when necessary |

Roles are clearly separated with no concern about boundary confusion.

## Proposal: Rebuild as 2-Stage Supplementation Mechanism

### Question Lifecycle Representation in draft.json

To support Stage 1 / Stage 2, rather than separating the pre-answer question list into a separate field, extend the existing `qa[]` as a **single list for question lifecycle**.

Minimum additional fields:

```json
{
  "qa": [
    {
      "id": "Q1",
      "status": "pending",
      "question": "...",
      "answer": "",
      "evidence": "...",
      "why": "...",
      "considered": "..."
    }
  ]
}
```

Meaning of status:

- `pending`: Before answer. Target of Stage 1 review.
- `approved`: Reviewed by Stage 1, question that can be presented to user.
- `answered`: Answered by user / autoApprove. Target of Stage 2 review.
- `dropped`: Question dropped as unnecessary / duplicate by Stage 1 review, etc. Retained as history.

In this design, `qa[]` becomes the single source of truth. By not separating pre-answer questions and answered QA into separate artifacts, question IDs, review feedback, user answers, and subsequent spec transcription can be tracked on the same array.

Make review a 2-stage structure, and purify both stages to **only generate additional questions** (no negation of user answers). Both stages have only one criterion: **"goal achievability of the issue/request"**.

### Stage 1: Review After Question Generation (Pre-Answer)

- **Input**: Questions with `status=pending` in `draft.json.qa[]` (pre-answer)
- **Criterion**: "If all these questions are answered, will the information necessary to achieve the issue/request goal be gathered?"
- **Output**: Topics not covered for goal achievement (= questions that should be added)
- **Timing**: Immediately after AI generates question group, before user starts answering
- **Effect**: Scope-irrelevant questions can be rejected before user answers, so user effort is not wasted

### Stage 2: Review After Answer Completion (Post-Answer)

- **Input**: All questions + answers with `status=answered` in `draft.json.qa[]`
- **Criterion**: **Same "goal achievability"**. However, input becomes question + answer
- **Output**: "Answer is insufficient for goal achievement → additional questions" "New topic found necessary for goal achievement → additional questions"
- **Timing**: After user completes answers
- **Effect**: Does not negate existing answers, only generates additional questions

### Common: Single Criterion

Both stages have only one criterion: **"goal achievability of the issue/request"**.

- Fixed to 1 evaluation axis → reviewer judgment drift fundamentally shrinks
- Termination condition is self-evident (ends when sufficient information for goal achievement is gathered)
- Draft's original purpose and criterion are directly linked

## Goal Clarification Mechanism (auto-check Integration)

For the criterion "goal achievability" in both stages to function, **the goal must be clearly described** is a prerequisite. This is achieved by reusing the existing auto-check mechanism.

### auto-check goal Hard Gate

auto-check is not the source for transcribing to `draft.json.goal`. Goal persistence is the responsibility of the draft phase, and `draft.json.goal` is generated directly from request / issue at the start of draft.

However, auto-check evaluates goal extractability as a hard gate for autoApprove eligibility. Even if score meets the threshold, if goal cannot be extracted, set `eligible=false`.

auto-check prompt / schema is written in English. AI output includes `goal` as a temporary field for judgment, but is not persisted to `autoCheck` state.

Prompt direction example:

```text
Also extract a concise goal statement from the input.

- goal must be a non-empty string when the input contains enough information to identify the intended outcome.
- goal must be an empty string when the intended outcome cannot be determined without user clarification.
- The goal is used only as an auto-mode hard gate. It is not persisted as part of the auto-check verdict.
```

Temporary AI output shape:

```json
{
  "goal": "<concise goal statement, or empty string when unclear>",
  "specBuildability": N,
  "ambiguity": N,
  "verifiability": N,
  "scopeBoundedness": N,
  "targetSpecificity": N,
  "precedent": N,
  "reason": "..."
}
```

Persisted autoCheck state keeps the existing score-oriented shape and does not include `goal`:

```json
{
  "eligible": true,
  "score": 20,
  "maxScore": 24,
  "threshold": 16,
  "breakdown": {
    "specBuildability": 2,
    "ambiguity": 2,
    "verifiability": 2,
    "scopeBoundedness": 2,
    "targetSpecificity": 1,
    "precedent": 1
  },
  "staticGates": { "G": false, "H": false, "I": false },
  "reason": "..."
}
```

### draft.json goal generation

- draft phase starts by generating `draft.json.goal` directly from request / issue.
- `draft.json.goal` is then confirmed by Stage 1 Q1.
- manual mode: user confirmation / correction.
- autoApprove mode: AI-confirmed acceptance by auto-selecting [1].
- if `draft.json.goal` cannot be generated in autoApprove mode, autoApprove must stop and return to manual confirmation.

### Stage 1 Q1 (Fixed, Required)

The **first Q1 of questions generated by Stage 1 is always fixed to goal confirmation**.

**Case A: auto-check successfully extracts goal (`draft.json.goal` is non-empty)**

```
Q1: Should we proceed with the following goal?
"<draft.json.goal>"

[1] Proceed with this goal
[2] Revise the goal
[3] Other
```

**Case B: auto-check fails to extract goal (`draft.json.goal` is empty)**

```
Q1: What is the goal of this task?
[1] Enter the goal manually
[2] Ask the AI to propose candidate goals
[3] Other
```

### Processing After Q1 Answer

- **Overwrite `draft.json.goal`** with user answer content (record as confirmed goal)
- Q2 and beyond are the body of Stage 1 (= generate missing topics through goal coverage judgment)

### Behavior in autoApprove

Q1 is treated as user confirmation in manual mode, and as **AI-confirmed acceptance** in autoApprove mode.

- Case A: auto-select [1] → auto-check extracted goal is confirmed as-is. This is recorded as AI-confirmed acceptance by autoApprove, not actual user confirmation.
- Case B: When auto-check fails to extract goal and `draft.json.goal` is empty, autoApprove does not continue. Since the criterion "goal achievability" for Stage 1 is not established, return to manual confirmation.

Therefore, Stage 1 must not proceed in autoApprove with `draft.json.goal` still empty.

## User Confirmation in spec phase: Return to draft via reopen-draft

### Design

When AI detects an event in spec phase that requires user confirmation, **rather than ad-hoc querying the user, return to draft phase via existing `flow run reopen-draft`**.

Reason: spec phase is originally the work of "synthesizing using information gathered in draft." If user intervention is required, returning to draft phase where the QA mechanism is defined is consistent.

### Operation Sequence

```
AI detects an issue in spec phase that requires user confirmation
  ↓
sdd-forge flow run reopen-draft --reason "<detected issue>"
  ↓
Return to draft phase → append an additional question to draft.json.qa[]
  ↓
User answers → re-approve → return to spec phase and resume synthesis
```

### Relationship with Existing Mechanism

`reopen-draft` is defined in spec 254 for draft regression from task-impl:

> Use `sdd-forge flow run reopen-draft [--reason "<text>"]` to rewind the draft step.
> Preconditions: at least one done task exists and the flow lifecycle is still `active`.

This proposal requires **phase-aware extension**:

- When called before spec phase completion: done task precondition is not required. Treat as regression to add missing confirmation in draft and regenerate spec.
- When called in impl phase or later: Maintain conventional done task precondition and task append semantics.

Rollback scope:

- reopen before spec phase completion: Return `draft` to `in_progress`, return `review-draft`, `gate-draft`, `spec`, `review-spec`, `gate`, `approval`, `test`, `review-test` to `pending`.
- reopen in impl phase or later: Maintain current behavior, return draft / gate-draft and handle task append round.

Handling of spec artifacts:

- Existing `spec.json` / `spec.md` / task files are not deleted.
- However, they are considered stale after reopen, and regenerated / re-synced in the spec step.
- Reason for leaving stale artifacts: To not lose comparison / confirmation material for the reason of regression.

Handling of reason:

- `--reason` is recorded in issue-log as before.
- In draft phase, append additional question with `status=pending` to `draft.json.qa[]` based on that reason.
- This makes "why returned to draft" and "what to confirm" trackable in the artifact.

### Explicit Trigger Conditions

Specify explicitly in spec creation prompt:

- Examples that trigger: Major change to implementation policy / adding requirements not described in draft / technology selection that cannot be determined in spec (something that should have been asked in draft)
- Examples that do not trigger: Wording improvements / typo fixes / rationale additions / internal implementation details that AI can determine independently in spec

### Benefits

1. **Reuse of existing mechanism**: No new commands needed, low maintenance burden
2. **Trace of regression**: "Why returned" is recorded with --reason → analyzable in retro / review
3. **Consistent flow lifecycle**: Same mechanism for impl→draft and spec→draft

### Immediate Clarification of Ambiguous Answers

To avoid the structure where review / gate later negates user answers, ambiguous answers are not passed to gate-draft but clarified on the spot during draft dialogue.

Example:

```text
User: Please handle it appropriately.
AI: Do you mean that Redis should be adopted?

[1] Yes
[2] No
```

Through this clarification, only confirmed answers that can be used for spec creation are saved in `qa[].answer`.

Responsibility allocation:

- **During draft dialogue**: If user answer is immediately ambiguous, request immediate clarification with closed options.
- **Stage 2 review**: Look at the entire QA that appears to be established, and find additional topics necessary for goal achievement. Do not negate existing answers.
- **gate-draft**: Detect structural problems that cannot be caught by immediate confirmation in artifacts that passed through dialogue and review. Examples: redundancy across multiple QAs, missing evidence, coverage gaps against goal, status transition inconsistencies.

In autoApprove, since user cannot be asked back, place constraints that AI itself does not create ambiguous answers. Write answers as closed decisions, and do not use undecided terms like "appropriately" / "as needed". When judgment is impossible, record in `openQuestions` and return to manual confirmation rather than continuing autoApprove.

## gate-draft Guardrail Redesign (Transfer from review)

Transfer quality judgment responsibility (shallow / ambiguous / redundant) that review relinquishes to gate-draft.

### Transfer Mapping

| review Focus Item | Transfer Destination | Revision Content |
|---|---|---|
| shallow / generic questions | `complete-context` extension | Add "QA questions must have spec-drivable specificity" to body |
| ambiguous / unsupported answers | Immediate clarification during draft dialogue + `unambiguous-requirements` supplement | Ask back with closed options on the spot and save only confirmed answers to `qa[].answer`. gate supplements detection of remaining structural deficiencies |
| redundant entries | New `qa-no-redundant-entries` | "Multiple QA entries must not duplicate the same concern" |
| missing coverage | (Remains in review) | Goal coverage of review Stage 1/2 |

### Guardrail Wording Proposals

#### `complete-context` Extended Version

> Each requirement and QA question must include enough surrounding context for reviewers to judge satisfaction. **QA questions must be specific enough to drive a useful spec — avoid generic / shallow questions like "How should we handle this?" — instead ask concrete decisions like "Which retry strategy: exponential backoff, jitter, or fixed delay?"**

#### `unambiguous-requirements` Extended Version

> Requirements must be unambiguous — avoid vague adjectives. **QA answers must contain concrete decisions with supporting rationale, not vague statements like "適切に処理する". When a decision is made, evidence (file references, prior decisions, etc.) should support it.**

#### New `qa-no-redundant-entries`

```json
{
  "id": "
... (truncated)