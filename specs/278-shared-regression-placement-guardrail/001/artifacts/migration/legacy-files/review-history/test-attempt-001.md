# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/278-shared-regression-placement-guardrail/test-coverage.json`

## Blocking Findings

### 1. Prompt movement instruction is not tested as a single contract
**Target:** specs/278-shared-regression-placement-guardrail/tests/prompt-guidance-placement-procedure.test.js R1/R4
**Issue:** The tests assert that words like "prompt guidance", "move", "shared regression tests", and "placement-contract assertions" appear somewhere in the skill file, but they do not require those terms to appear in the same instruction or procedural context. The test could pass if the words are scattered across unrelated sections without requiring the procedure to check related shared regression tests when prompt guidance moves.
**Required change:** Assert a cohesive instruction fragment or paragraph that ties prompt guidance movement to checking related shared regression tests for placement-contract assertions.
**Why blocking:** R1 and R4 require a specific procedural instruction contract, and the current tests can pass without exercising that production behavior.

### 2. General applicability is not validated
**Target:** specs/278-shared-regression-placement-guardrail/tests/prompt-guidance-placement-procedure.test.js R3
**Issue:** The R3 test only checks for the presence of "flow skill" and "flow prompt" and the absence of the exact phrase "workflow board guidance only". Procedure text limited to workflow board guidance using different wording would still pass.
**Required change:** Add an assertion that the movement rule applies to prompt guidance generally, or reject workflow-board-specific qualifiers in the relevant instruction text.
**Why blocking:** R3 requires the rule not be limited to workflow board guidance, but the current test does not actually guard that requirement.


## Advisory Findings

No advisory findings.