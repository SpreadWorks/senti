# Code Review Results

### [ ] 1. Clarify Retry Constant Semantics
**File:** `src/flow/lib/run-gate.js`  
**Issue:** `DEFAULT_GATE_RETRY_MAX` does not clearly communicate whether the value is per-phase, per-run, or global, which can cause misuse as retry logic grows.  
**Suggestion:** Rename it to something explicit like `DEFAULT_RETRY_MAX_PER_PHASE` (and align local variable names in `resolveRetryMax`) so intent is unambiguous.

**Verdict:** REJECTED
**Reason:** No verdict provided

### [ ] 2. Consolidate Retry Policy Into One Object
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Retry-related defaults are split across multiple constants (`DEFAULT_GATE_RETRY_MAX`, `RETRY_TRACKED_PHASES`), which increases drift risk and duplicates policy definition points.  
**Suggestion:** Introduce a single frozen policy object, e.g. `const RETRY_POLICY = Object.freeze({ maxPerPhase: 5, trackedPhases: [...] })`, and consume it throughout retry/escalation logic.

**Verdict:** REJECTED
**Reason:** Mostly structural/cosmetic here; it adds indirection without clear functional gain, and it can blur boundaries between related-but-not-identical concerns (max budget vs tracked phases), which increases accidental coupling risk.

### [ ] 3. Reduce Schema Coupling in Guardrail Text
**File:** `src/presets/base/guardrail.json`  
**Issue:** The guardrail `body` now hardcodes field names (`evidence`, `why`, `considered`), coupling policy wording to a specific QA schema and making future schema updates harder.  
**Suggestion:** Keep `body` policy-focused and move field-specific exceptions into a structured `meta` key (for example `meta.allowedReferenceFields`) so rule text stays stable.

**Verdict:** REJECTED
**Reason:** Current guardrail evaluation logic consumes `body` text directly for AI checks; moving field-specific allowance into `meta` would likely change behavior unless prompt/rendering logic is also updated to include that meta.

### [ ] 4. Remove Redundant Allowance Wording
**File:** `src/presets/base/guardrail.json`  
**Issue:** The updated `body` contains two separate “code reference is allowed” allowances, which can be read as overlapping exceptions and reduce clarity.  
**Suggestion:** Merge into one concise condition that clearly scopes allowance to QA justification context, avoiding duplicated phrasing and interpretation ambiguity.

**Verdict:** REJECTED
**Reason:** The two allowances are similar but not fully redundant (general context references vs QA-justification references). Merging them risks narrowing or broadening policy interpretation in AI judgment with limited quality upside.
