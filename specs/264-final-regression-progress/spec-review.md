# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Progress stream can corrupt envelope stdout
**Target:** R1/R2/R3/R4 and Design Principles
**Issue:** The spec allows progress and artifact-link messages on either stdout or stderr, but flow commands are envelope commands: src/flow/lib/base-command.js sets outputMode="envelope" and src/lib/dispatcher.js writes the final JSON envelope to stdout. Emitting human progress on stdout before the envelope would make stdout non-JSON for machine callers, despite the design principle saying the machine-readable envelope must not be broken.
**Required change:** Constrain the user-visible final-regression progress and artifact-link output to stderr, or explicitly to the existing non-stdout human stream, and state that stdout remains the JSON envelope.
**Why blocking:** Without this correction, an implementation can satisfy the acceptance tests by printing to stdout while breaking the existing flow command output contract; downstream callers that parse stdout as the envelope would fail.

### 2. Failure artifact output omits existing root-mismatch path
**Target:** R4
**Issue:** R4 only requires artifact guidance when final-regression fails after a process attempt or discovery error. Existing run-final-regression has another artifact-producing failure path: worktree root mismatch creates final-regression-result.json and a raw attempt log without running discovery or a child process.
**Required change:** Broaden R4 to cover every final-regression failure path that writes final-regression-result.json and a raw log, including the worktree root mismatch path; exclude only failures that occur before those artifact paths can be created.
**Why blocking:** If left unchanged, implementation and tests can skip an existing mandatory failure path, leaving root-mismatch failures without the artifact guidance the scope promises and making the behavior inconsistent across final-regression failures.


## Non-blocking Improvements

### 1. Name the progress integration files
**Target:** Codebase Context
**Improvement:** Add src/lib/dispatcher.js and src/flow/lib/base-command.js to the related files because they define the envelope stdout contract and the available stderr-facing human output pattern.
**Why non-blocking:** The implementation can still be completed by discovering these files during coding, but listing them would reduce the chance of stream-contract mistakes.

### 2. Clarify command display convention
**Target:** R1
**Improvement:** Clarify whether the displayed command should reuse ParsedCommand.toString() exactly or include parsed environment assignments from ParsedCommand.env.
**Why non-blocking:** Existing artifact behavior already provides a usable command string convention, but env-bearing configured commands could otherwise be displayed less completely than they execute.
