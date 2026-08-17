# Code Review Results

### 1. 1. Consolidate Post-Hook Step Lists
**File:** `.agents/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The post-hook-managed steps are listed in multiple places, with overlapping wording for `test-execute`, `test-result-review`, `retro`, `finalize-*`, and review commands. This makes future flow changes easy to document inconsistently.  
**Suggestion:** Add one “Post-hook managed steps” subsection and have “Flow Progress Tracking” and dispatcher step C.2 reference that subsection instead of repeating the lists.

### 2. 2. Make Dispatcher Loop Bound Explicit
**File:** `.agents/skills/sdd-forge.flow/SKILL.md`  
**Issue:** “bounded by the finite flow schema and the returned `maxAttempts`” is directionally correct, but “remaining step count” is not an explicit numeric bound. This weakens the bounded-resource-usage guardrail.  
**Suggestion:** State a concrete stop condition, for example: “Stop after `maxAttempts` consecutive non-progress attempts, and never process more than the number of remaining schema steps reported by next-action/context.”

### 3. 3. Clarify Step ID vs Command Naming
**File:** `.agents/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The text mixes step names and command names, e.g. `gate-impl` versus `flow run gate`, which can make the dispatcher guidance harder to follow.  
**Suggestion:** Use a consistent pattern such as “step `gate-impl` via `flow run gate`” wherever both concepts appear.

### 4. 1. Consolidate Post-Hook Step Lists
**File:** `.claude/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The post-hook-managed steps are listed in multiple places, with overlapping wording for `test-execute`, `test-result-review`, `retro`, `finalize-*`, and review commands. This makes future flow changes easy to document inconsistently.  
**Suggestion:** Add one “Post-hook managed steps” subsection and have “Flow Progress Tracking” and dispatcher step C.2 reference that subsection instead of repeating the lists.

### 5. 2. Make Dispatcher Loop Bound Explicit
**File:** `.claude/skills/sdd-forge.flow/SKILL.md`  
**Issue:** “bounded by the finite flow schema and the returned `maxAttempts`” is directionally correct, but “remaining step count” is not an explicit numeric bound. This weakens the bounded-resource-usage guardrail.  
**Suggestion:** State a concrete stop condition, for example: “Stop after `maxAttempts` consecutive non-progress attempts, and never process more than the number of remaining schema steps reported by next-action/context.”

### 6. 3. Clarify Step ID vs Command Naming
**File:** `.claude/skills/sdd-forge.flow/SKILL.md`  
**Issue:** The text mixes step names and command names, e.g. `gate-impl` versus `flow run gate`, which can make the dispatcher guidance harder to follow.  
**Suggestion:** Use a consistent pattern such as “step `gate-impl` via `flow run gate`” wherever both concepts appear.

### 7. 1. Rename route validation collection for accuracy
**File:** `src/flow/definition.js`  
**Issue:** `DRAFT_REVIEW_ROUTE_PAIRS` is not really a list of pairs; each entry is a route plus expected step ids used for invariant checking. The current name makes its purpose less clear.  
**Suggestion:** Rename it to something like `DRAFT_REVIEW_ROUTE_EXPECTATIONS` or `DRAFT_REVIEW_ROUTE_ASSERTIONS` so the validation loop reads as intentional consistency checking.

### 8. 2. Reduce duplicated draft review route wiring
**File:** `src/flow/definition.js`  
**Issue:** The draft question/coverage routes are defined once as constants, duplicated again inside `DRAFT_REVIEW_ROUTE_PAIRS`, and then referenced manually in `FLOW_DEFINITION`. This creates three places that must stay aligned.  
**Suggestion:** Keep a single route expectation table and derive the route constants or insertion calls from that table where possible. For example, store `{ key, expectedTriageStepId, expectedRepairStepId }`, resolve `draftReviewRouteForKey(key)` once inside a helper, and use the resolved route for both validation and node creation.

### 9. 1. Extract Shared Artifact Header Validation
**File:** `src/flow/lib/run-gate.js`
**Issue:** `validateDraftReviewArtifact`, `validateDraftTriageArtifact`, and `validateDraftRepairArtifact` repeat the same shape checks for `version`, `phase`, source link fields, `summary`, and bounded `items` arrays.
**Suggestion:** Add small helpers such as `validateArtifactVersionAndPhase(...)`, `validateArtifactSourceLink(...)`, and `validateBoundedItemsArray(...)` to reduce duplication and make later artifact validators follow one consistent pattern.

### 10. 2. Rename `draftArtifactMatchKey` To Reflect Its Collision-Prone Scope
**File:** `src/flow/lib/run-gate.js`
**Issue:** `draftArtifactMatchKey` sounds like a stable artifact identity, but it only combines `title` and `target`. If blocking findings and repair targets share those fields, the `Map` in `validateDraftTriageArtifact` can silently collapse entries.
**Suggestion:** Rename it to something narrower like `draftFindingTitleTargetKey`, or include `classification`/source array in the key so the name and behavior both represent a unique review item identity.

### 11. 3. Centralize Bounded Slice Logic
**File:** `src/flow/lib/run-gate.js`
**Issue:** The code repeatedly applies `.slice(0, LIMIT)` after checking array length. This pattern appears for review arrays, triage items, repair items, route sets, and coverage triage inspection.
**Suggestion:** Introduce a helper like `boundedItems(items, limit)` or `validateBoundedArray(...)` that both reports over-limit arrays and returns the bounded view. This would make the bounded-resource guardrail easier to audit and avoid future inconsistencies.

### 12. I’ll review this as a focused quality pass on the touched file only, including the bounded-resource guardrail.The supplied path is relative to the repository diff, but this sandbox’s current directory appears to be the flow `.tmp` directory rather than the repo root. I’ll avoid broad filesystem movement and use the provided diff as the review source.### 1. Inline One-Use Route Helpers
**File:** `src/flow/lib/run-reopen-draft.js`  
**Issue:** `draftReviewArtifactNamesForReopen()` and `draftReviewResetStepIdsForReopen()` are called exactly once to initialize constants. They add indirection without encapsulating reusable behavior.  
**Suggestion:** Define `STALE_DRAFT_REVIEW_ARTIFACTS` and `PLAN_REOPEN_ROUTE_RESET_STEPS` directly from `DRAFT_REVIEW_ROUTES.flatMap(...)`, or replace both with one shared field-collection helper if this pattern is expected to grow.

### 13. 2. Use Domain-Specific Naming for Reset Steps
**File:** `src/flow/lib/run-reopen-draft.js`  
**Issue:** `PLAN_REOPEN_ROUTE_RESET_STEPS` is vague because “route” describes the implementation source, not the domain meaning. The old name made it clearer that these are draft-review steps.  
**Suggestion:** Rename it to something like `PLAN_REOPEN_DRAFT_REVIEW_RESET_STEPS` so the reset list remains understandable without knowing `DRAFT_REVIEW_ROUTES`.

### 14. 1. Preserve Draft PASS Routing
**File:** `src/flow/lib/run-review.js`
**Issue:** `resolveDraftReviewNextStep()` validates `verdict` but does not use it for routing. `PASS`, `ADVISORY`, and `FAIL` all return `resolveDraftReviewRoute(retryPhase).triageStepId`, which conflicts with the requirement that draft review routing distinguish those outcomes.
**Suggestion:** Route `PASS` directly to the normal `next` step, and use the retry-phase triage route only for `ADVISORY` or `FAIL`. Pass `next` into `resolveDraftReviewNextStep()` or handle the `PASS` branch in `resolvePhaseReviewNextStep()`.

### 15. 2. Remove Redundant Verdict Structures
**File:** `src/flow/lib/run-review.js`
**Issue:** `REVIEW_VERDICT_VALUES`, `REVIEW_VERDICTS`, and `REVIEW_VERDICT_PATTERN` represent the same source of truth in three forms. This is small, but it creates extra surface area for drift when verdict values change.
**Suggestion:** Keep `REVIEW_VERDICT_VALUES` as the single source and derive validation inline with `includes()` or expose a small helper such as `isReviewVerdict(verdict)`. Retain the generated regexp if useful, but avoid maintaining both a `Set` and an array unless lookup performance matters here.

### 16. 3. Make Retry Phase Fallback Naming More Specific
**File:** `src/flow/lib/run-review.js`
**Issue:** `DEFAULT_DRAFT_REVIEW_RETRY_PHASE` is used only when resolving a route, not as a general retry-phase default for parsing or artifacts. The current name suggests broader behavior than it provides.
**Suggestion:** Rename it to something route-specific, for example `DEFAULT_DRAFT_REVIEW_ROUTE_RETRY_PHASE`, or move the fallback into a helper named around route resolution so the default’s scope is clear.

### 17. 1. Consolidate Empty-Finding And Verdict Rules
**File:** `src/flow/prompts/plan/review-draft-coverage.md`  
**Issue:** The bullets for “No findings means...” and “Verdict mapping...” partially duplicate the same state definitions, which makes future edits easier to drift.  
**Suggestion:** Merge them into one verdict table or compact bullet, e.g. `PASS = all arrays empty; ADVISORY = advisoryFindings[] or repairTargets[] non-empty with no blockingFindings[]; FAIL = blockingFindings[] non-empty`.

### 18. 2. Clarify Whether Repair Runs On Empty Results
**File:** `src/flow/prompts/plan/review-draft-coverage.md`  
**Issue:** “if there are no findings, triage/repair write empty bookkeeping artifacts” may imply repair still performs work even when there are no repair targets. That slightly weakens the review/triage/repair responsibility split.  
**Suggestion:** Reword to make the mechanical behavior explicit, such as: `The next step is draft-coverage-triage; when there are no findings, downstream triage/repair steps should only produce their required empty bookkeeping artifacts and must not mutate draft.json.`

### 19. 1. Clarify Verdict Helper Naming
**File:** `src/flow/registry.js`  
**Issue:** `isDraftReviewStepCompletingVerdict()` includes `FAIL`, which can read as “the flow step passed/completed successfully” even though `FAIL` is blocking. The intent appears to be that the review command produced a terminal verdict and the review step itself can be marked done.  
**Suggestion:** Rename the helper and constant to something like `isDraftReviewTerminalVerdict()` / `DRAFT_REVIEW_TERMINAL_VERDICTS` or `isDraftReviewRecordedVerdict()` to make it clear that `FAIL` is intentionally included.

### 20. 1. Remove Duplicate Route Insert Logic
**File:** `src/lib/flow-store.js`  
**Issue:** `migrateDraftReviewTriageAndRepairSteps()` defines a nested `insertBefore()` helper that is specific to draft review, but its behavior overlaps with existing migration patterns in the file: locate a consumer, synthesize status from nearby steps, insert missing leaves.  
**Suggestion:** Extract a small reusable helper such as `insertMissingStepsBefore(steps, consumerId, stepIds, createStep)` at file scope. This keeps migration functions flatter and makes future step migrations follow the same pattern.

### 21. 2. Rename Empty Artifact Factory For Accuracy
**File:** `src/lib/flow-store.js`  
**Issue:** `createEmptyDraftMigrationArtifact()` sounds like it creates a complete artifact, but it only creates common fields shared by several artifact types.  
**Suggestion:** Rename it to something like `createDraftMigrationArtifactBase()` so callers make it clear that review, triage, and repair factories add their own schema-specific fields.

### 22. 3. Avoid Recomputing Step Lookup After Migration
**File:** `src/lib/flow-store.js`  
**Issue:** `writeEmptyDraftReviewMigrationArtifacts()` rebuilds a bounded step list and `Map` after `migrateDraftReviewTriageAndRepairSteps()` already scanned and mutated the same step collection. This is minor duplication and makes the migration flow harder to reason about.  
**Suggestion:** Have `migrateDraftReviewTriageAndRepairSteps()` return richer migration metadata, for example the inserted done repair step IDs, or pass the bounded step list into both functions. Then artifact generation can use the same migration view.

### 23. 4. Bound Artifact Write Fan-Out Explicitly
**File:** `src/lib/flow-store.js`  
**Issue:** `writeEmptyDraftReviewMigrationArtifacts()` writes up to three artifacts per route, but the route count is not locally bounded in this function. The current bound is implicit through `DRAFT_REVIEW_ROUTES`, which weakens the `bounded-resource-usage` guardrail if routes grow later.  
**Suggestion:** Add an explicit route-count guard or derive a constant maximum for draft review routes before looping, similar to `MAX_FLOW_STEPS_FOR_MIGRATION` and `MAX_FLOW_ARTIFACTS_FOR_MIGRATION`.

### 24. 1. Extract Repeated Draft Review Phase Sets
**File:** `src/templates/skills/rules.json`  
**Issue:** The same new phase sequence appears repeatedly across several rules: `flow.review-draft-questions`, `flow.draft-questions-triage`, `flow.draft-questions-repair`, `flow.draft-refine`, `flow.review-draft-coverage`, `flow.draft-coverage-triage`, `flow.draft-coverage-repair`. This duplication makes future phase renames or additions easy to miss.  
**Suggestion:** If the rules loader supports or can be extended to support named groups, replace repeated literal arrays with shared phase groups such as `draftQuestionReviewFlow` and `draftCoverageReviewFlow`. If not, consider adding a generation step for this JSON so repeated phase lists are assembled from one canonical definition.

### 25. 1. Make the Dispatcher Bound Operational
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`
**Issue:** The new bounded-loop sentence says the loop is bounded by the finite schema and `maxAttempts`, but it does not define exactly what counter the agent should track or how to calculate “remaining step count.”
**Suggestion:** Replace it with an explicit instruction such as: “Track attempted dispatcher iterations. Stop after `<number of remaining schema steps> * maxAttempts` iterations, or earlier if the next-action result repeats without advancing state.”

### 26. 2. Avoid Duplicating Draft Review Routing
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`
**Issue:** The draft review route table hardcodes step relationships that likely already exist in the flow schema/registry. This creates a second source of truth that can drift from the CLI behavior.
**Suggestion:** Replace the table with guidance to follow the route returned by `next-action` or the flow schema, while keeping the semantic rule: review writes detection artifacts, triage decides disposition, repair performs mutation/audit.

### 27. 3. Clarify PASS Handling Language
**File:** `src/templates/skills/sdd-forge.flow/SKILL.md`
**Issue:** “empty PASS triage/repair artifact generation when required” is ambiguous: it is unclear who decides “when required” and whether repair should run for PASS.
**Suggestion:** Name the deciding source explicitly, for example: “when required by the next-action instructions or schema hooks,” and clarify whether PASS can enter repair only for artifact completion rather than mutation.

### 28. 1. Clarify relative-order helper naming
**File:** `tests/unit/flow/flow-steps.test.js`  
**Issue:** `assertStepOrder` sounds like it may assert an exact or adjacent sequence, but it only checks that each step appears somewhere after the previous one.  
**Suggestion:** Rename it to something more explicit, such as `assertStepsAppearInOrder` or `assertRelativeStepOrder`, so future test edits do not confuse relative ordering with strict sequence validation.

### 29. 1. Divergent Flow Skill Documentation
**File:** `.agents/skills/sdd-forge.flow/SKILL.md`
**Issue:** The generated skill and its template both contain overlapping dispatcher bounds, draft-review routing, and PASS/triage/repair guidance. This creates two documentation surfaces that can drift.
**Suggestion:** Treat `src/templates/skills/sdd-forge.flow/SKILL.md` as the source of truth, update it once, then run `sdd-forge upgrade` to regenerate `.agents/skills/sdd-forge.flow/SKILL.md`.

### 30. 2. Draft Review Routes Have Multiple Sources Of Truth
**File:** `src/flow/definition.js`
**Issue:** Draft-review route relationships are repeated across the flow definition, rules JSON phase lists, skill template route guidance, reopen reset logic, migration logic, and review routing. Several summaries point to the same risk: route IDs and phase sequences can drift across files.
**Suggestion:** Centralize draft-review route metadata in one module and derive validation, reset-step lists, migration inserts, and documentation/rules generation from that canonical structure.

### 31. 3. Artifact Schema Is Duplicated Between Writers And Validators
**File:** `src/flow/lib/run-gate.js`
**Issue:** Gate validation and migration artifact creation both encode the draft review/triage/repair artifact shape independently. If required fields or item limits change, `run-gate.js` and `src/lib/flow-store.js` can become incompatible.
**Suggestion:** Introduce shared artifact helpers or classes for draft-review artifact bases, item bounds, and source links, then use them from both validators and migration artifact factories.

### 32. 4. Verdict Semantics Are Named And Routed Inconsistently
**File:** `src/flow/lib/run-review.js`
**Issue:** PASS/ADVISORY/FAIL behavior is described in prompts/templates, routed in `run-review.js`, and interpreted in `registry.js`. The summaries show inconsistent naming around “completing,” “terminal,” retry phase defaults, and whether PASS should enter triage/repair.
**Suggestion:** Define one verdict policy helper that owns valid verdicts, terminal/completing semantics, and next-step routing. Reuse that naming in `registry.js`, prompts, and skill text.
