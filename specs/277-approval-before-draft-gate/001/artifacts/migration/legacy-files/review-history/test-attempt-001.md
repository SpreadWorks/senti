# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/277-approval-before-draft-gate/test-coverage.json`

## Blocking Findings

### 1. Approval guidance assertions do not verify the required approval state
**Target:** specs/277-approval-before-draft-gate/tests/draft-gate-approval-guidance.test.js::assertApprovalSetupGuidance
**Issue:** R1 requires the guidance to instruct confirming draft.json.approval.approved is true and approval.confirmedAt is set before running the draft gate, but the test only checks that the field names and gate command appear somewhere in the text. A prompt that mentions approval.approved as false, or mentions approval.confirmedAt without requiring it to be set, would still pass.
**Required change:** Strengthen the prompt/next-action assertions to verify the guidance requires approval.approved to be true and approval.confirmedAt to be set or non-empty before `sdd-forge flow run gate --phase draft`.
**Why blocking:** This leaves a must-level acceptance condition without executable coverage and could allow an implementation that mentions the fields without instructing the required approval setup.

### 2. Unresolved user decision guard is not covered precisely
**Target:** specs/277-approval-before-draft-gate/tests/draft-gate-approval-guidance.test.js::assertApprovalSetupGuidance
**Issue:** R2 requires the guidance not to approve a draft while a `requires_user_decision` item remains unresolved, but the test only checks for the generic phrase `no unresolved user decision`. It does not fail if the guidance also tells users to approve despite unresolved `requires_user_decision` items.
**Required change:** Add a focused negative assertion that the guidance does not instruct approving or proceeding while unresolved `requires_user_decision` items remain, or add a positive assertion that approval setup is conditional on all `requires_user_decision` items being resolved.
**Why blocking:** This is a must-level validation-contract requirement and the current test could pass while the guidance contradicts the required unresolved-decision guard.


## Advisory Findings

No advisory findings.