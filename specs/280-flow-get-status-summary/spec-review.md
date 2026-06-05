# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Clarify boolean flag registration
**Target:** Overview / Modules: src/flow/registry.js
**Improvement:** Mention that `--details` should be registered in the command metadata as a boolean flag (`args.flags`) rather than a value-taking option (`args.options`), because the dispatcher treats those categories differently.
**Why non-blocking:** The required user-facing behavior is already clear and implementable from the existing dispatcher/registry patterns; this only reduces implementation ambiguity.

### 2. Strengthen stop-field test fixture
**Target:** Acceptance Criteria AC1-AC2
**Improvement:** Consider seeding a state where `reviewStop` or `gateStop` would be present, then asserting default output omits it and `--details` includes it when present.
**Why non-blocking:** R2 and R3 already provide an observable contract for these fields, so tests can be designed without this clarification; the acceptance criteria would simply become more complete.
