# Spec Review Results

## Verdict: ADVISORY

## Blocking Findings

No blocking findings.

## Non-blocking Improvements

### 1. Clarify registry-failure fixture boundary
**Target:** R3 / Acceptance Criteria
**Improvement:** The spec could clarify that the fallback case should be exercised with a valid or missing project config plus an unreadable/malformed enabled plugin registry entry, not an invalid `.senti/config.json`. `src/senti.js` initializes the container and loads config before `src/presets-cmd.js`, so invalid config can fail before the non-strict preset inventory path is reached.
**Why non-blocking:** R3 is still implementable and testable using existing registry failure paths such as malformed plugin metadata; this clarification only prevents a misleading test fixture choice.

### 2. Pin project-root resolution in tests
**Target:** R1 / tests/spec-local
**Improvement:** For CLI tests, explicitly set the subprocess cwd and preferably `SENTI_WORK_ROOT` to the temporary project root. The existing `repoRoot()` resolution prefers `SENTI_WORK_ROOT`, then git root, then cwd, so making the project root explicit avoids accidental coupling to the surrounding repository layout.
**Why non-blocking:** The acceptance criteria already state that the command runs from the temporary project; this only makes the intended test setup less fragile.
