# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Explicit runtime log path bypasses relocation
**Target:** Constraints / R4-R5
**Issue:** The spec preserves the existing `--log-file` option but does not define finalize-cleanup behavior when `--log-file` resolves under the worktree being deleted. In current code, `src/lib/dispatcher.js` uses `input.logFile` directly via `path.resolve(paths.root, input.logFile)`, bypassing `paths.agentWorkDir`.
**Required change:** Specify whether finalize-cleanup relocates, rejects, or otherwise handles a relative or absolute `--log-file` that resolves inside the deleted worktree, while preserving outside-worktree absolute paths if intended.
**Why blocking:** An implementation can relocate `agentWorkDir` and still write the runtime log under the deleted worktree whenever `--log-file` is supplied, violating the goal and leaving tests without a correct expected behavior for this existing CLI path.

### 2. Configured logger dir bypasses agentWorkDir relocation
**Target:** Constraints / R4-R5
**Issue:** The spec says logger writes are derived from the effective agent work dir, but `src/lib/container.js` uses `config.logs.dir` when present and resolves it against the worktree root. A relative `logs.dir` under a cleanup-deleted worktree is not covered by the relocation rule.
**Required change:** Add the finalize-cleanup rule for `config.logs.dir` when it resolves inside the deleted worktree, such as relocating it to a durable main-repo path or explicitly preserving only outside-worktree absolute overrides.
**Why blocking:** JSONL logger writes can remain pointed at the deleted worktree even after `agentWorkDir` relocation, so the known `[sdd-forge] log write failed` class of failure can persist through an existing configuration path that the spec does not make testable.


## Non-blocking Improvements

### 1. Mention stale guidance partial
**Target:** Codebase Context / R6
**Improvement:** Add `src/templates/partials/worktree-mode.md` to the guidance-related files because it currently describes cleanup Report delivery in terms of the response envelope and may need wording aligned with the CLI display contract.
**Why non-blocking:** The core CLI behavior and tests can still be implemented without this mention; it just helps keep generated project guidance consistent.
