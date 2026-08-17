# Test Review Results

## Verdict: ADVISORY

Coverage artifact: `specs/271-flow-judgment-contract/test-coverage.json`

## Blocking Findings

No blocking findings.

## Advisory Findings

### 1. R1 constructor invariant only exercises one of nine required fields
**Target:** specs/271-flow-judgment-contract/tests/flow-judgment-contract.test.js (it "R1: rejects ...")
**Improvement:** The R1 test only asserts a throw when `targetStep` is missing (/targetStep/). R1 names nine constructor invariants (targetStep, artifactPath, verdict, blockingFindings, failureKind, nextAction, rawArtifactPath, inputFingerprint, artifactFingerprint). Add throw assertions for the other required fields (or a table-driven loop over each omitted field) so the invariant enforcement is fully pinned.
**Why non-blocking:** R1 already has real constructor-invariant coverage that exercises production behavior; the remaining fields are an extension of an existing, passing assertion rather than an uncovered requirement.

### 2. R2 normal-completion policy tested for only two of five target steps
**Target:** specs/271-flow-judgment-contract/tests/flow-judgment-contract.test.js (it "R2: applies target-step normal completion policies")
**Improvement:** Only test-review (ADVISORY) and final-regression (pass / failureKind / nextAction) policies are asserted. R2 also defines distinct normal-completion rules for impl-review (PASS|ADVISORY & blocking=0), impl-gate (pass & blocking=0), and test-result-review (verdict=pass). Add allowsNormal true/false cases for those three steps, including a blockingFindings>0 negative case for test-review/impl-review/impl-gate.
**Why non-blocking:** R2 has working policy coverage that exercises the StepCompletionPolicy mechanism; the missing steps are additional cases of an already-validated API, not a missing test.

### 3. R3 override required-field and allowed-disposition coverage is shallow
**Target:** specs/271-flow-judgment-contract/tests/flow-judgment-contract.test.js (it "R3: validates override evidence and finding dispositions")
**Improvement:** The R3 test validates a happy-path override and rejects disposition "ignored", but does not exercise the other mandatory invariants: userApproval=true, reason, approvedAt, approvedBy, successorOwner, acceptedRisk, nor does it confirm the remaining allowed dispositions (out_of_scope, accepted_risk, false_positive) are accepted. Add positive cases for each allowed disposition and negative cases for missing required entry fields.
**Why non-blocking:** R3 has genuine disposition-validation coverage; the additional required-field and enum cases strengthen an already-covered requirement.

### 4. CompletionValidator "normal" return path is not directly asserted
**Target:** specs/271-flow-judgment-contract/tests/flow-judgment-contract.test.js (R4 / R8 validate cases)
**Improvement:** R4 specifies the validator returns normal | override | inconsistent, and R8 enumerates "normal completion PASS" as a required scenario. The tests assert validate() returning "inconsistent" (R4) and "override" (R8), and assert StepCompletionPolicy.allowsNormal===true (R2), but never assert CompletionValidator.validate(...) returns kind "normal" for a passing contract + done. Add a case asserting result.kind === "normal" so the validator happy path is regression-protected.
**Why non-blocking:** The "normal completion PASS" scenario is covered at the policy level (allowsNormal===true), satisfying R8's enumerated scenario; routing it through the validator is a complementary assertion, not an uncovered requirement.

### 5. R6 contract-summary assertions check only targetStep and omit two artifact types
**Target:** specs/271-flow-judgment-contract/tests/flow-judgment-contract.test.js (it "R6: converts target artifacts ...")
**Improvement:** The R6 test asserts only `summary.targetStep` for three converters (final-regression, test-result-review, impl-gate). R6 requires the summary to also carry artifactPath, verdict/result, blockingCount, failureKind, nextAction, completionKind, and progressSignature, and to maintain field sets for test-review and impl-review artifacts (no converter for those is exercised). Add assertions on the full summary shape and add test-review/impl-review conversion cases.
**Why non-blocking:** R6 has executable converter coverage for the majority of artifact types; the missing summary-field and converter cases extend an already-covered requirement rather than leaving it uncovered.

### 6. R5 envelope test omits the required `reason` field
**Target:** specs/271-flow-judgment-contract/tests/flow-judgment-contract.test.js (it "R5: exposes validation failure details ...")
**Improvement:** R5 requires Envelope.fail data.completionValidation to include stepId, result, reason, artifactPath, and overridePath. The test asserts stepId, result, artifactPath, and overridePath but not `reason`. Add an assertion that `envelope.data.completionValidation.reason` is present and non-empty.
**Why non-blocking:** R5's envelope contract is otherwise exercised and the failure-detail surface is validated; the missing field is one assertion on an already-covered structure.
