# Test Review Results

## Verdict: REJECTED

Coverage artifact: `specs/336-reset-draft-review-artifacts/test-coverage.json`

## Blocking Findings

### 1. PASS artifact source fields assert stale source paths instead of canonical route artifacts
**Target:** specs/336-reset-draft-review-artifacts/tests/draft-review-pass-artifacts.test.js:229
**Issue:** R1 requires the replacement questions triage artifact to set sourceReview equal to the questions route reviewArtifact, but the test expects sequence.harness.existingSourceReview, initialized as retained-questions-review-source.json. This encodes preservation of stale source metadata rather than canonical PASS replacement semantics. The same incorrect premise appears for R2 sourceTriage and R3 coverage sourceReview/sourceTriage expectations.
**Required change:** Update the PASS replacement expectations so triage.sourceReview equals route.reviewArtifact and repair.sourceTriage equals route.triageArtifact for both questions and coverage.
**Why blocking:** The tests would reject a correct implementation that writes the required canonical source fields, and could pass an implementation that preserves stale source fields after rewind.


## Advisory Findings

No advisory findings.