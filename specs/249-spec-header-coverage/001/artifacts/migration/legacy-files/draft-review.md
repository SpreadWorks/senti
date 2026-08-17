# Draft Review Results

8 issue(s) detected.

### 1. I’ll ground the review in the local repo first, especially any issue/spec artifacts for #305 and the files the draft cites. Then I’ll point out only QA weaknesses, not implementation advice beyond concrete spec improvements.The `.tmp` worktree path appears to have no tracked file output from `rg`; I’m checking the directory shape before relying on the draft’s file references.The actual repository files are one level above the provided `.tmp` cwd. I’ll read them by path from the current directory without changing the working directory, since this is a review-only task.I found the local `specs/249-spec-header-coverage` artifacts and the current `req-map`, retro, review, and set-step code. I’m narrowing the review around places where the draft over-specifies, contradicts existing flow behavior, or leaves request coverage shaky.### 1. Header Marker Decision Contradicts The Issue
**QA:** Q1  
**Issue:** Issue #305 explicitly introduces `# spec: R1 R2 ...`, but Q1 makes `# spec:` invalid for `.js/.mjs/.ts`, which are the current spec verification test formats. This turns the issue’s own example into an error for the main use case.  
**Suggestion:** Decide explicitly whether the current JS convention is `// spec:` or `# spec:`. If using `// spec:` for JS, state that the issue example is being adapted for executable JS tests and update prompt/test examples accordingly.

### 2. 2. Language-Agnostic Scope Is Inconsistent
**QA:** Q8  
**Issue:** Q1 discusses future `.md/.yaml` support and Q12 proposes a `.md` fixture, but Q8 discovery only includes `.(test|spec).(js|ts|mjs)`. The draft does not clearly separate “parser supports” from “files validated/discovered now.”  
**Suggestion:** Add a concrete current-scope rule: validation currently discovers only spec-local JS/TS/MJS test files, while non-Node discovery/runner support is deferred to dcb2. Remove `.md/.yaml` current examples unless they are actually discoverable.

### 3. 3. Set-Step Hook Conflicts With Existing Design
**QA:** Q6  
**Issue:** Q6 hardcodes `id === "test"` inside `SetStepCommand`, but the existing file documents that step side effects are definition-driven, not hardcoded by step ID. The QA does not justify this design break.  
**Suggestion:** Add a QA deciding whether validation should be modeled as `FlowNode` metadata/side effect/validator, or explicitly justify why `set-step` gets a special-case gate.

### 4. 4. Per-File Mismatch Detection Is Too Narrow
**QA:** Q7  
**Issue:** The proposed static regex only detects `it("R1: ...")`. It misses `test("R1: ...")`, `it.skip`, template literals, generated tests, and other valid Node test styles. This may produce false mismatch results while the issue says TAP R-ID extraction remains the test-level judgment mechanism.  
**Suggestion:** Either define `it("R<N>: ...")` as the required supported syntax in prompts and validation, or broaden detection/use per-file TAP extraction so it matches actual test execution semantics.

### 5. 5. `testable: false` Visibility Is Under-Covered
**QA:** Q4  
**Issue:** Q4 explicitly scopes out `spec.md` rendering and broader spec-context consumers, but `testable: false` becomes part of `spec.json.requirements`. If rendered specs and prompts hide it, reviewers and AI may not understand why a requirement is exempt.  
**Suggestion:** Add a QA entry deciding whether `testable: false` must be rendered in `spec.md` and included in spec-context prompts, or state why hidden metadata is acceptable.

### 6. 6. Retro Summary Shape Is Ambiguous
**QA:** Q3  
**Issue:** Q3 alternates between `summary.naCount` and `summary.na_count`, and its schema rationale conflates the AI response schema with the persisted static `retro.json` shape.  
**Suggestion:** Specify one persisted field name and define the exact static retro output contract separately from `RETRO_SCHEMA`.

### 7. 7. Envelope Output Channel Claim Is Unsupported
**QA:** Q9  
**Issue:** Q9 says failures are printed to stderr, but `Envelope.output()` prints JSON to stdout and sets `process.exitCode`. That contradicts the current command contract.  
**Suggestion:** Change the answer to: validation returns `Envelope.fail`; dispatcher serializes the envelope to stdout with non-zero exit code. Keep human-readable details in `errors[].messages`.

### 8. 8. Canonical Validation Shape Ignores Project OOP Rule
**QA:** Q6  
**Issue:** The draft defines `ValidationResult` and issue records as plain object shapes, while the project rule says meaningful structured values should be represented by classes with invariants and behavior.  
**Suggestion:** Either define `TestHeaderValidationResult` and issue classes, or explicitly justify why this boundary value is allowed to remain a plain envelope data object.
