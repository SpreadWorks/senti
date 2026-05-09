# Feature Specification: 255-vague-guardrail-enumerate

**Feature Branch**: `feature/255-vague-guardrail-enumerate`
**Created**: 2026-05-09
**Status**: Draft
**Input**: GitHub Issue #319

## Goal
Eliminate the structural cause of whack-a-mole gate retry loops on vague-expression guardrails (complete-context, unambiguous-requirements) by changing the gate AI reviewer to enumerate every violation in a single FAIL output and updating plan-phase author-side fix instructions to scan the entire artifact before fixing. Limit the change to src/flow/lib/run-gate.js's guardrail-article evaluation path; preserve buildImplCheckPrompt semantics; do not touch run-review.js / run-test-result-review.js.

## Background
complete-context (loops in 14/216 specs, max 6 iter) and unambiguous-requirements (loops in 4/216 specs, max 4 iter) frequently retry the gate because the AI reviewer cites only one example violation per FAIL — the author fixes that example, and the next iteration cites a different example in the same document. The current evaluation schema (run-gate.js:619-638) returns a single `reason: string` per guardrail, structurally inviting partial citation. The same schema is shared with the implementation-requirement check (buildImplCheckPrompt, run-gate.js:1283-1299) which has different semantics (PASS/FAIL per requirement, not list-violations-of-a-rule). The fix splits the schema, splits the parser, requires the article evaluation reviewer to enumerate every violation, and adds a plan-phase author-side instruction to scan the whole artifact before fixing.

## Scope
- Add GUARDRAIL_ARTICLE_EVAL_SCHEMA in src/flow/lib/run-gate.js with per-entry shape {guardrail_id, result, reason?, violations?: [{target, where, why_violates}]}; provider-facing JSON Schema is permissive (both reason and violations optional). Parser enforces structural invariants.
- Add IMPL_REQUIREMENT_EVAL_SCHEMA for the implementation-requirement check, identical in shape to today's GUARDRAIL_EVAL_SCHEMA. Remove the shared GUARDRAIL_EVAL_SCHEMA constant.
- Split the parser into parseGuardrailArticleEvaluation(rawResponse, knownIds) and parseImplRequirementEvaluation(rawResponse, knownIds). Both preserve known-id invariants (reject unknown / duplicates / missing). Article parser additionally enforces FAIL→violations[]>=1 with non-empty target/where/why_violates per entry, PASS/SKIP→non-empty reason without violations field, and rejects duplicate (guardrail_id, target, where) triples.
- Article parser writes a derived `reason` summary on FAIL article entries (joined '<target> — <why_violates> (at <where>)' across violations with '; ' separator). The format includes `where` so issue-log persistence carries location across iterations. Downstream consumers (jaccard, applyFlipOverride, buildGateReport, appendIssueLogFromGateResult) read this derived reason without code changes.
- EvaluationSchemaError gets `code = 'EVALUATION_SCHEMA_ERROR'` set on the error class. BOTH parseGuardrailArticleEvaluation AND parseImplRequirementEvaluation throw EvaluationSchemaError on invariant violation; the gate command's caller catches it inside src/flow/lib/run-gate.js BEFORE returning to the dispatcher, manually increments gateRetry (RETRY_TRACKED_PHASES), manually appends an issue-log entry, and returns Envelope.fail with errors[0].code='EVALUATION_SCHEMA_ERROR'. Catch points: runGateFlow's AI-call wrapper (covers article path for executeDraft/executeSpec/executeTaskSpec) AND executeDiffBasedGate's two AI calls (covers requirement path via parseImplRequirementEvaluation and article path via checkGuardrail's parseGuardrailArticleEvaluation).
- Rename buildGuardrailPromptFromFiltered to buildGuardrailArticleEvalPrompt and export it. Rules section instructs per-occurrence enumeration with required target+where+why_violates; document-level guardrails emit one or more entries (one per distinct gap); diff-scope retains its restriction. Textual prompt sections (added to the prompt body via PromptBuilder.add) appear in this order: rules → fmt fallback → previously-passed (if any) → diff-scope (if any) → articles → content. JSON Schema is sent via PromptBuilder.setJsonSchema as a separate provider payload — independent of textual ordering.
- Update GUARDRAIL_FMT_FALLBACK for the article shape; keep a separate fmt fallback aligned with IMPL_REQUIREMENT_EVAL_SCHEMA used by buildImplCheckPrompt.
- Update reasonsFromEvaluations to emit ONE row per violation on FAIL article entries. detail format: '<title> — <target> — <why_violates> (at <where>)' so the location is included in the persisted text (issue-log keeps the existing entry.reason flat-text shape, but the text now carries the location). PASS/SKIP/requirement entries emit one row using `reason`.
- data.artifacts.evaluations on FAIL article entries includes the violations[] array verbatim; data.artifacts.reasons holds rendered rows; data.artifacts.issues unchanged.
- Update src/flow/prompts/plan/gate.md: display every reason row from data.artifacts.reasons; add the spec.json scan instruction listing the literal authored fields per R11 (canonical list). The same prompt is shared by the spec gate (executeSpec) and task-spec gate (executeTaskSpec); for task-spec the relevant edit target is spec.json.tasks[<id>] specifically — the prompt instruction tells the author to derive `<id>` from the evaluated task markdown filename (basename without .md, per R22) and edit only that entry.
- Update src/flow/prompts/plan/gate-draft.md: display every reason row; add the draft.json scan instruction listing the literal fields goal, analysis (problem, proposedApproach, validation), scopeVerification.in/.out, impactOnExisting, qa[].question/.answer/.why/.considered, openQuestions; exclude approval and evidence.
- Add tests using the existing test seam (mocked agents and pure-function unit tests). Required new exports: GUARDRAIL_ARTICLE_EVAL_SCHEMA, IMPL_REQUIREMENT_EVAL_SCHEMA, parseGuardrailArticleEvaluation, parseImplRequirementEvaluation, buildGuardrailArticleEvalPrompt.

## Out of Scope
- src/flow/commands/review.js, src/flow/lib/run-review.js — verified not to use the affected schema or parser.
- src/flow/lib/run-test-result-review.js — verified to have its own schema (test-result-review.json).
- buildImplCheckPrompt semantics — schema and parser shape unchanged; only the constant and function names change.
- src/flow/prompts/impl/gate-impl.md — author-side scan instruction (B) NOT added; existing diff-only fix discipline preserved.
- appendIssueLogFromGateResult — no schema change; entry.reason text + flat failedEvaluations[] preserved.
- Adding new guardrails (REQ-SPEC variants etc.).
- Changing retry budget / maxAttempts policy.
- Modifying review-spec.md / review-draft.md / review-test.md prompts beyond display tweaks driven by reasons[] shape.
- Changing issue-log schema to persist violations[].
- Changing assertNoRepeatedFail to operate on violations[] sets.
- draft-scope-boundary handling (separate spec dbf7).
- Per-guardrail meta flags (meta.enumerate). Document-level vs instance-level handling is prompt-level.

## Constraints
- alpha policy: no backward-compatibility shims — the previous GUARDRAIL_EVAL_SCHEMA constant and parseEvaluationResponse export are removed, not aliased.
- External dependency policy: only Node.js built-ins; no new packages.
- Provider-facing JSON Schema must not require oneOf / conditional schemas (codex / claude CLIs differ in oneOf support). Invariants are enforced by the parser, not by JSON Schema.
- All gate phases (draft, spec, task-spec, task-impl, integration) consume the new article schema for guardrail-article evaluation; the requirement-implementation check (task-impl, integration) uses the separate IMPL_REQUIREMENT_EVAL_SCHEMA path.
- Tests must be deterministic — no live LLM calls; use mocked agents and pure-function inputs.
- Token cost for the article path increases marginally because the reviewer enumerates every instance instead of one example.

## Design Principles
- Schema split by concern: article-evaluation (list violations of a rule across content) and requirement-implementation-check (per-requirement PASS/FAIL on a diff) have different semantics — they get different schemas and different parser functions.
- Provider-permissive schema, parser-strict invariants: keep the JSON Schema simple so any provider can accept it; enforce FAIL→violations / PASS→reason as a parser-side contract.
- Derived summary preserves downstream consumers: parser-derived FAIL `reason` (joined target — why_violates) flows into existing jaccard, applyFlipOverride, buildGateReport, and issue-log persistence so no other code path needs to change.
- Per-occurrence enumeration for instance-level violations: each edit location gets its own entry; required `where` makes every entry uniquely actionable; document-level violations are first-class with one entry per distinct gap.
- Author-side scan is prompt-level reinforcement, not schema-level: gate.md / gate-draft.md list literal artifact fields to scan; gate-impl.md is excluded because it has a different fix discipline (diff-only).
- Test seams via intentional exports: schemas, parsers, and prompt builder become named exports for direct unit tests; rendering glue is tested via gate envelope output.

## Overview
### Modules
- src/flow/lib/run-gate.js — owns the new schemas (GUARDRAIL_ARTICLE_EVAL_SCHEMA, IMPL_REQUIREMENT_EVAL_SCHEMA), the new parsers (parseGuardrailArticleEvaluation, parseImplRequirementEvaluation), the renamed prompt builder (buildGuardrailArticleEvalPrompt), GUARDRAIL_FMT_FALLBACK, reasonsFromEvaluations, gatePass / gateFail.
- src/flow/prompts/plan/gate.md — plan-phase spec gate prompt; displays every reason row and instructs scan of spec.json fields before fixing.
- src/flow/prompts/plan/gate-draft.md — plan-phase draft gate prompt; displays every reason row and instructs scan of draft.json fields before fixing.
- tests/ — unit tests for schemas, parsers, prompt builder, derived reason summary, plus mocked-agent gate envelope tests for multi-violation rendering and malformed-output handling.

### Data Flow
- Article path: AI agent → JSON response → parseGuardrailArticleEvaluation → parsed evaluations[] (FAIL entries carry violations[]) → derived FAIL reason summary → reasonsFromEvaluations → data.artifacts.reasons (one row per violation on FAIL) → gate envelope → jaccard / applyFlipOverride / buildGateReport / appendIssueLogFromGateResult / prompt display.
- Requirement path: AI agent → JSON response → parseImplRequirementEvaluation → parsed evaluations[] (reason per entry) → reasonsFromEvaluations → data.artifacts.reasons (one row per entry) → unchanged consumers.

### Decisions
- [VERIFY] Confirmed GUARDRAIL_EVAL_SCHEMA is shared between buildGuardrailPromptFromFiltered (article path) and buildImplCheckPrompt (requirement path) — split required to isolate behavior.
- [VERIFY] Confirmed downstream consumers of `evaluations[].reason`: applyFlipOverride run-gate.js:1263-1276; assertNoRepeatedFail run-gate.js:1189-1234 (jaccard input); buildGateReport run-gate.js:800-820; appendIssueLogFromGateResult run-gate.js:1960. All read e.reason as a single string. Derived reason summary on FAIL entries preserves these consumers without code changes.
- [VERIFY] Confirmed run-review.js and run-test-result-review.js do not import GUARDRAIL_EVAL_SCHEMA or parseEvaluationResponse — they have separate schemas. Only run-gate.js consumes the affected surface.
- Field name decision: violation entry uses `target` (not `quote`) so the same field carries either a verbatim text excerpt (instance-level) or a short gap descriptor (document-level) without a discriminator. `where` is REQUIRED to make duplicates distinguishable; `why_violates` is REQUIRED so each entry is independently actionable.
- Prompt section ordering is normative: rules → schema → fmt fallback → previously-passed (if any) → diff-scope (if any) → articles → content. The schema directive precedes the previously-passed informational section so the latter cannot be read as a schema relaxation.
- Author-side scan instruction (B) added only to gate.md and gate-draft.md (plan phase). gate-impl.md (impl phase) keeps its existing 'fix using only failure reasons and git diff — do NOT re-read the full spec' discipline; adding a scan instruction there would conflict.

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- Per-guardrail meta.enumerate flag to opt into exhaustive enumeration — Rejected: defers benefit and adds metadata churn. Splitting article-eval vs requirement-impl-eval already isolates blast radius without per-guardrail gating.
- Hard-code complete-context and unambiguous-requirements as the only enumerated guardrails — Rejected: brittle and does not generalize to other whack-a-mole guardrails the issue body anticipates (REQ-SPEC variants etc.).
- Single parser with a mode parameter instead of two parser functions — Rejected: branching inside the parser confuses invariants and makes call-site intent less obvious.
- Single schema with conditional/oneOf requirements (FAIL requires violations, PASS requires reason) — Rejected: provider compatibility — codex/claude CLIs differ in oneOf support; permissive provider schema with parser-strict invariants is more robust.
- Keep `reason` field as a parallel summary alongside violations[] on FAIL (do not remove it on input) — Rejected: invites the reviewer to fall back to single-citation behavior. Forcing violations[] on FAIL removes the structural escape; parser overwrites any model-supplied FAIL reason with the derived summary.
- Optional `where` on violation entries — Rejected: makes identical-target entries ambiguous. Required `where` makes every entry uniquely actionable.
- Keep field name `quote` (not `target`) and document dual mode — Rejected: contract is implicit and weakens schema. `target` is neutral and supports both verbatim excerpts and gap descriptors without ambiguity.
- Single document-level violation entry per guardrail FAIL — Rejected: hides multiple distinct document-level gaps and recreates partial-fix loop. Allowing one or more entries surfaces every actionable gap.
- Group identical repeated violations (same `target`) into one entry with locations[] — Rejected: weakens enumeration. Per-occurrence is enforced; duplicates are distinguishable by `where`.
- Add author-side scan instruction to gate-impl.md too — Rejected: conflicts with existing impl-phase 'do NOT re-read the full spec' discipline. Schema-level enumeration (A) is sufficient for impl phase.
- Extend issue-log persistence to store violations[] arrays — Rejected: out of scope and requires schema migration. Derived FAIL reason in `entry.reason` already grows in fidelity automatically; jaccard pipeline operates on text.
- Switch assertNoRepeatedFail comparison to operate on violations[] sets directly — Rejected: out of scope and risks behavior drift in spec 210's no-progress guard.
- Apply enumeration to review.js / run-review.js / run-test-result-review.js as well — Rejected: review.js / run-review.js produce free-form markdown without a structured retry loop; run-test-result-review.js has a different domain (test-execute integrity) and its own schema.
- Test only via the public envelope (no new exports for schemas / parsers / prompt builder) — Rejected: schema and prompt structure are first-class behaviors; envelope tests hide failure modes. Exporting only the new structural surfaces produces stable behavioral tests without enlarging the public surface unnecessarily.

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- R1 [must]: Replace the shared GUARDRAIL_EVAL_SCHEMA in src/flow/lib/run-gate.js with two distinct constants: GUARDRAIL_ARTICLE_EVAL_SCHEMA (per-entry {guardrail_id, result, reason?, violations?: [{target, where, why_violates}]}, with both outer fields optional in the JSON Schema) and IMPL_REQUIREMENT_EVAL_SCHEMA (per-entry {guardrail_id, result, reason}). Both schemas reject extra properties.
- R2 [must]: Split parseEvaluationResponse into parseGuardrailArticleEvaluation(rawResponse, knownIds) and parseImplRequirementEvaluation(rawResponse, knownIds). Both reject unknown id, duplicate id, and missing id (parity with existing behavior).
- R3 [must]: parseGuardrailArticleEvaluation rejects (with EvaluationSchemaError) any FAIL entry that lacks violations[], has empty violations[], has any violation entry with empty target / where / why_violates, or contains duplicate (guardrail_id, target, where) triples. It rejects PASS/SKIP entries that include a violations field or omit a non-empty reason.
- R4 [must]: parseGuardrailArticleEvaluation writes a derived FAIL `reason` field on each FAIL entry by joining '<target> — <why_violates> (at <where>)' across all violations with '; ' separator. The derived reason includes `where` so issue-log persistence (entry.reason and failedEvaluations[].reason via buildFailedEvaluations) carries the location across iterations. The derived reason replaces any reason value supplied by the model on FAIL entries.
- R5 [should]: EvaluationSchemaError sets `code = 'EVALUATION_SCHEMA_ERROR'` on the error instance (in addition to existing `name`). When EITHER parseGuardrailArticleEvaluation OR parseImplRequirementEvaluation throws it, the calling site inside src/flow/lib/run-gate.js (BEFORE returning to the dispatcher) catches the error and returns Envelope.fail with errors[0].code='EVALUATION_SCHEMA_ERROR' and errors[0].messages containing the parser-thrown text. The catch must cover ALL parse call sites: (a) runGateFlow's article-check AI call (covers executeDraft / executeSpec / executeTaskSpec); (b) executeDiffBasedGate's bulk requirement-parse call (the `!perReqDiffs` branch using buildImplCheckPrompt, line 1823-1831 equivalent); (c) executeDiffBasedGate's per-requirement parse call inside the perReqDiffs loop (line 1867-equivalent); (d) executeDiffBasedGate's article-check call via checkGuardrail (line 851-equivalent). Behavior by phase: for RETRY_TRACKED_PHASES (draft / spec / task-impl / integration), the catch manually increments gateRetry and manually appends an issue-log entry via appendIssueLogFromGateError before returning Envelope.fail. For non-tracked phases (task-spec), the catch returns Envelope.fail without incrementing retry or appending issue-log (consistent with task-spec being excluded from RETRY_TRACKED_PHASES). The catch occurs inside run-gate.js so the dispatcher's post-hooks (which skip on ok:false) do not execute and no double-counting occurs.
- R6 [must]: Rename buildGuardrailPromptFromFiltered to buildGuardrailArticleEvalPrompt. The rules text (passed to PromptBuilder.setRules and rendered into the systemPrompt) instructs the reviewer to (a) for instance-level guardrails: emit ONE violation entry per occurrence/edit location with required target+where+why_violates; (b) for document-level guardrails: emit ONE OR MORE entries, one per distinct gap, with target as a gap descriptor and where as the artifact name; (c) when diff-scope applies: list only violations introduced by the diff. PromptBuilder API allocation: rules → systemPrompt (set via setRules); JSON Schema → separate jsonSchema payload (set via setJsonSchema, sent to provider as schema, NOT a textual section); fmt fallback → separate fmtFallback payload (set via setFmtFallback). Sections added via PromptBuilder.add (which become userPrompt) appear in this textual order: previously-passed (if any) → diff-scope (if any) → articles → content. Tests for ordering assert this userPrompt section order — not the position of jsonSchema or fmtFallback (those are separate fields, independent of textual order). PromptBuilder itself is NOT modified.
- R7 [must]: buildImplCheckPrompt is updated to use IMPL_REQUIREMENT_EVAL_SCHEMA and parseImplRequirementEvaluation; its prompt text and parser invariants are otherwise unchanged.
- R8 [should]: GUARDRAIL_FMT_FALLBACK text matches the GUARDRAIL_ARTICLE_EVAL_SCHEMA shape (violations on FAIL, reason on PASS/SKIP). The implementation-requirement path uses a separate fmt fallback aligned with the unchanged shape.
- R9 [must]: reasonsFromEvaluations emits ONE row per violation on FAIL article entries: verdict 'FAIL', detail '<title> — <target> — <why_violates> (at <where>)' (the `where` value is appended to the detail string in parentheses), plus a separate `where` field for structured access. The detail-string inclusion ensures the existing appendIssueLogFromGateResult path (which persists r.detail into entry.reason and failedEvaluations[].reason) carries the location across iterations. PASS/SKIP article entries and all requirement entries emit one row each using `reason` (existing behavior).
- R10 [should]: data.artifacts.evaluations stores the parsed shape augmented with title/category metadata (existing behavior — see R21). FAIL article entries additionally retain the violations[] array. data.artifacts.reasons reflects R9's per-violation rows. data.artifacts.issues field shape is unchanged.
- R11 [must]: src/flow/prompts/plan/gate.md displays every row in data.artifacts.reasons after a FAIL and adds the literal instruction 'Before fixing, scan these fields in spec.json (the source of truth — spec.md is regenerated by `sdd-forge spec render`) for additional instances of the same violation pattern: goal, background, scope.in, scope.out, constraints, design_principles, requirements[].desc, acceptance_criteria, alternatives_considered[].option / .reason, open_questions, clarifications[].q / .a, keywords, implementationTargets, user_approval.notes, overview.modules[].text, overview.data_flow[].text, overview.decisions[].text / .evidence / .consideredAlternatives, tasks[].title / .goal / .acceptance / .implementation_notes / .test_strategy. Excluded as control / metadata fields: id, status, origin, added_round, parent, testable, priority, user_approval.approved, user_approval.confirmed_at, overview.modules[].added_by_task, overview.data_flow[].added_by_task, overview.decisions[].added_by_task. For the task-spec gate phase (active when an individual task markdown is being checked) the relevant edit target is spec.json.tasks[<id>] specifically; the prompt notes this so task-spec failures are fixed by editing the corresponding spec.json.tasks[] entry. After fixing all instances in spec.json, run `sdd-forge spec render --spec specs/<spec-id>` to regenerate spec.md / task markdown, and re-run the gate.'
- R12 [must]: src/flow/prompts/plan/gate-draft.md displays every row in data.artifacts.reasons after a FAIL and adds the literal instruction 'Before fixing, scan these fields in draft.json for additional instances of the same violation pattern: goal, analysis (problem, proposedApproach, validation), scopeVerification.in / .out, impactOnExisting, qa[].question / .answer / .why / .considered, openQuestions. Excluded: approval, evidence. Fix all instances in this iteration, not only the ones the reviewer enumerated.'
- R13 [must]: src/flow/prompts/impl/gate-impl.md is NOT modified. The existing 'fix using only failure reasons and git diff — do NOT re-read the full spec' discipline is preserved.
- R14 [must]: Add named exports for GUARDRAIL_ARTICLE_EVAL_SCHEMA, IMPL_REQUIREMENT_EVAL_SCHEMA, parseGuardrailArticleEvaluation, parseImplRequirementEvaluation, and buildGuardrailArticleEvalPrompt in src/flow/lib/run-gate.js. Remove obsolete exports for parseEvaluationResponse and any references to GUARDRAIL_EVAL_SCHEMA.
- R15 [must]: All NEW test files for this spec are placed under specs/255-vague-guardrail-enumerate/tests/ with a `// spec: R<N>` header (or multiple `R<N>` IDs) on the first line — per the spec-test-coverage guardrail. Existing migrated test files (per R18) remain in their current locations (tests/unit/...). Tests cover: GUARDRAIL_ARTICLE_EVAL_SCHEMA shape (FAIL/PASS/SKIP); parseGuardrailArticleEvaluation rejection (FAIL empty/missing violations, target/where/why_violates empty, PASS with violations, SKIP without reason, unknown id, duplicate id, missing id, duplicate (guardrail_id, target, where) triple, extra entry-level keys, extra violation-level keys); parseGuardrailArticleEvaluation derives reason summary on FAIL with exact asserted string '<target> — <why_violates> (at <where>)'; gate envelope on multi-violation FAIL renders N rows in data.artifacts.reasons; buildGuardrailArticleEvalPrompt text contains exhaustive-enumeration directive, document-level guidance, and userPrompt section ordering (R6); parseImplRequirementEvaluation regression for unknown/duplicate/missing parity; both parsers reuse extractJsonCandidate. All tests use mocked agents or pure-function inputs.
- R16 [should]: Mocked-agent tests cover all four R5 catch sites: (1) runGateFlow article path malformed output (covers executeDraft / executeSpec); (2) executeDiffBasedGate bulk requirement-parse path (`!perReqDiffs` branch); (3) executeDiffBasedGate per-requirement parse path (perReqDiffs loop); (4) executeDiffBasedGate article checkGuardrail path. Each test asserts envelope errors[0].code === 'EVALUATION_SCHEMA_ERROR'. For RETRY_TRACKED_PHASES the test additionally asserts gateRetry counter incremented by 1 and an issue-log entry appended; for the task-spec catch site (covered by runGateFlow when phase=task-spec) the test asserts the counter is NOT incremented and no issue-log entry is appended. Additional regression: assertNoRepeatedFail with constructed low-overlap fixture does not throw; assertNoRepeatedFail with constructed high-overlap fixture throws ESCALATE_REPEATED_FAIL; applyFlipOverride flips a current FAIL article entry to PASS when previous run had identical content and PASSed.
- R17 [must]: applyFlipOverride drops the violations field when flipping a FAIL article entry to PASS, preserving the parser invariant that PASS entries have no violations field. The flipped entry retains guardrail_id and the existing flip-marker reason text (current behavior) and is freshly free of violations.
- R18 [must]: Existing tests that reference the old names — tests/unit/specs/commands/guardrail.test.js, tests/unit/specs/commands/guardrail-metadata.test.js, tests/unit/flow/gate-evaluation-schema.test.js, tests/unit/flow/gate-pass-history-prompt.test.js — are migrated to the new exports (parseGuardrailArticleEvaluation, parseImplRequirementEvaluation, GUARDRAIL_ARTICLE_EVAL_SCHEMA, IMPL_REQUIREMENT_EVAL_SCHEMA, buildGuardrailArticleEvalPrompt). Article-style assertions are updated to the new violations-array contract; requirement-style assertions retain the single-reason contract. Prompt-shape assertions (gate-pass-history-prompt.test.js) are updated to the new section ordering and rules text.
- R19 [should]: Both parsers reject unknown keys on each evaluation entry. Allowed keys at the entry level: {guardrail_id, result, reason, violations} for the article parser and {guardrail_id, result, reason} for the requirement parser. The model MAY supply `reason` on a FAIL article entry; the parser is not required to reject it (R4 overwrites it with the derived summary) — only keys outside the allowed set are rejected. The article parser additionally rejects unknown keys on each violation entry (allowed: {target, where, why_violates}). On extra-key detection the parser throws EvaluationSchemaError. Rationale: provider JSON Schema enforcement is not uniform across codex/claude profiles; parser-side rejection prevents unsanctioned fields from entering downstream artifacts.
- R20 [must]: Both parsers reuse the existing JSON-candidate extraction logic (extractJsonCandidate) so behavior with fenced JSON (```json...```) and surrounding noise is preserved. extractJsonCandidate stays in scope as a shared helper; both new parsers call it at entry.
- R21 [must]: Parsed evaluations passed to data.artifacts.evaluations are augmented with `title` and `category` metadata (existing behavior — title from guardrail.title, category from guardrail.meta.category for article entries; for requirement entries title=guardrail_id and category='requirements'). FAIL article entries additionally retain the violations[] array. Downstream consumers (reasonsFromEvaluations, buildGateReport) continue to use title/category exactly as today.
- R22 [must]: task-spec gate prompt instruction must derive the task id from the evaluated artifact path. executeTaskSpec evaluates `specs/<spec>/tasks/<id>.md`; the gate prompt's scan instruction (when phase=task-spec) tells the author to edit spec.json.tasks[] entry whose `id` matches the file basename (without `.md`), then run `sdd-forge spec render`. The derivation rule is stated in gate.md so the AI fixer knows which entry to scan.

## Acceptance Criteria
- Running `npm test` passes with the new schema, parser, prompt builder, and rendering changes.
- A unit test fixture with two distinct vague phrases in a draft.json input yields a single guardrail FAIL evaluation whose violations[] array contains exactly two entries (verified via parseGuardrailArticleEvaluation).
- A unit test fixture with two violations on a single guardrail FAIL produces exactly two rows in data.artifacts.reasons after gate evaluation (mocked agent).
- buildGuardrailArticleEvalPrompt output text contains the literal substrings 'one violation entry per occurrence' (or equivalent enumeration directive) and 'document-level' (or equivalent document-level guidance), and the section order is rules → schema → fmt fallback → (previously-passed) → (diff-scope) → articles → content.
- parseImplRequirementEvaluation produces the same outputs as old parseEvaluationResponse on a regression fixture of requirement-style inputs (unknown / duplicate / missing id parity preserved).
- src/flow/prompts/plan/gate.md and gate-draft.md contain the literal scan-instruction substrings listed in R11 and R12 verbatim.
- src/flow/prompts/impl/gate-impl.md content is unchanged from the baseline.
- src/flow/lib/run-gate.js exports include all five new names listed in R14, and exclude parseEvaluationResponse and GUARDRAIL_EVAL_SCHEMA.
- On a malformed-output fixture (FAIL with empty violations), the gate envelope contains errors[0].code === 'EVALUATION_SCHEMA_ERROR' and the gate retry counter is incremented by 1.
- applyFlipOverride applied to a FAIL article entry (with violations[]) returns a PASS entry whose violations field is absent (deleted), preserving the schema invariant.
- Existing tests at tests/unit/specs/commands/guardrail.test.js and tests/unit/flow/gate-evaluation-schema.test.js no longer reference the removed names parseEvaluationResponse or GUARDRAIL_EVAL_SCHEMA, and pass under the new schema contracts.

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Split GUARDRAIL_EVAL_SCHEMA into article and requirement schemas
  - Replace the shared schema with GUARDRAIL_ARTICLE_EVAL_SCHEMA (article path) and IMPL_REQUIREMENT_EVAL_SCHEMA (requirement path), both as JSON Schema objects on src/flow/lib/run-gate.js. Add named exports for both.
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Split parseEvaluationResponse into article and requirement parsers
  - Replace parseEvaluationResponse with parseGuardrailArticleEvaluation and parseImplRequirementEvaluation. Update buildGuardrailPromptFromFiltered's call site to use the article parser; update buildImplCheckPrompt's call site to use the requirement parser. Add named exports for both functions.
  - see `tasks/T-2.md` for full spec
- **T-3** [pending]: Derive FAIL reason summary in the article parser
  - Inside parseGuardrailArticleEvaluation, write a derived `reason` field on each FAIL entry by joining '<target> — <why_violates> (at <where>)' across all violations with '; ' separator. The derived value replaces any model-supplied reason on FAIL.
  - see `tasks/T-3.md` for full spec
- **T-4** [pending]: Surface schema errors via gate envelope and retry counter
  - When parseGuardrailArticleEvaluation throws EvaluationSchemaError inside the gate command, the gate emits envelope {ok:false, errors[0].code: 'EVALUATION_SCHEMA_ERROR'} with the parser message in errors[0].messages, increments the gate retry counter (one slot consumed), and writes an issue-log entry equivalent to a normal FAIL.
  - see `tasks/T-4.md` for full spec
- **T-5** [pending]: Rewrite the article-eval prompt builder
  - Rename buildGuardrailPromptFromFiltered to buildGuardrailArticleEvalPrompt and export it. Update its rules and section ordering per R6.
  - see `tasks/T-5.md` for full spec
- **T-6** [pending]: Update fmt fallback for the article path
  - Update GUARDRAIL_FMT_FALLBACK to describe the article shape (violations on FAIL, reason on PASS/SKIP). Add a separate fmt fallback aligned with IMPL_REQUIREMENT_EVAL_SCHEMA used by buildImplCheckPrompt.
  - see `tasks/T-6.md` for full spec
- **T-7** [pending]: Update reasonsFromEvaluations to render per-violation rows
  - reasonsFromEvaluations emits ONE row per violation on FAIL article entries: verdict 'FAIL', detail '<title> — <target> — <why_violates>', plus a `where` field. PASS/SKIP article entries and all requirement entries emit one row each using `reason` (current behavior).
  - see `tasks/T-7.md` for full spec
- **T-8** [pending]: Update gate.md prompt for spec.json scan and multi-row display
  - src/flow/prompts/plan/gate.md displays every row in data.artifacts.reasons after a FAIL and adds the literal scan instruction for spec.json fields (per R11).
  - see `tasks/T-8.md` for full spec
- **T-9** [pending]: Update gate-draft.md prompt for draft.json scan and multi-row display
  - src/flow/prompts/plan/gate-draft.md displays every row in data.artifacts.reasons after a FAIL and adds the literal scan instruction for draft.json fields (per R12).
  - see `tasks/T-9.md` for full spec
- **T-10b** [pending]: Update applyFlipOverride to drop violations on flip
  - Modify applyFlipOverride so that when it flips a FAIL article entry to PASS, the returned entry has no violations field (delete the field on the cloned entry). PASS / SKIP entries without violations are returned unchanged.
  - see `tasks/T-10b.md` for full spec
- **T-10c** [pending]: Migrate existing parser / schema / prompt tests to new exports
  - Update all tests that reference the removed names to use the new exports. Affected files: tests/unit/specs/commands/guardrail.test.js, tests/unit/specs/commands/guardrail-metadata.test.js, tests/unit/flow/gate-evaluation-schema.test.js, tests/unit/flow/gate-pass-history-prompt.test.js. Migrate parser imports, schema imports, prompt builder name, and update assertions accordingly.
  - see `tasks/T-10c.md` for full spec
- **T-10** [pending]: Add regression and supplementary tests under specs/255-vague-guardrail-enumerate/tests/
  - Cover the changes with deterministic tests using mocked agents and pure-function inputs (per R15 and R16). All NEW test files for this spec are placed under specs/255-vague-guardrail-enumerate/tests/ with a `// spec: R<N>` header on the first line of each file (per spec-test-coverage guardrail). Existing files migrated by T-10c stay in their current locations (tests/unit/...) — those are pre-existing shared tests, not new tests for this spec.
  - see `tasks/T-10.md` for full spec
