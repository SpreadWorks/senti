# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Clarify how scenario-validity detects implementation-target source changes
**Target:** R4
**Improvement:** Spell out what counts as an implementation-target source change (e.g., diff scope vs base, src/ paths, ignore-list for specs/<spec>/tests/) so the runner has an unambiguous precondition check.
**Why non-blocking:** The high-level intent is clear and implementable from existing git-diff patterns in the repo; refinement improves precision but does not block implementation or test design.

### 2. Specify scenario-validity-result.json schema fields
**Target:** R5
**Improvement:** List the exact field names and types for the version, raw_output_path, command, process details, and per-requirement summary entries, mirroring how test-execute-result.json version 2 is documented.
**Why non-blocking:** R7 already constrains evidence subfields and the existing test-execute schema provides a clear precedent, so the runner and tests can be built without further spec changes.

### 3. Define raw_output_lines format
**Target:** R7
**Improvement:** State whether raw_output_lines is a [start,end] pair, an inclusive line range string, or an array of line numbers, and how it references tests/.raw/scenario-validity.log.
**Why non-blocking:** The validation intent is clear enough to implement and test; format choice can be settled at implementation time without changing scope.

### 4. Reference next-action schema path
**Target:** R1
**Improvement:** Confirm the exact location of next-action/scenario-validity.schema.json (e.g., src/flow/schemas/next-action/) consistent with sibling schemas, to avoid ambiguity during implementation.
**Why non-blocking:** Existing schema directory conventions make the target derivable; explicit mention is a clarification only.
