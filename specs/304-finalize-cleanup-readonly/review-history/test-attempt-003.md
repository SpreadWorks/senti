# Test Review Results

## Verdict: FAIL

Coverage artifact: `specs/304-finalize-cleanup-readonly/test-coverage.json`

## Blocking Findings

### 1. R1 only tests path mapping, not absence of target-worktree writes
**Target:** specs/304-finalize-cleanup-readonly/tests/finalize-cleanup-readonly.test.js
**Issue:** The R1 coverage does not snapshot or inspect the target worktree for new or modified files across cleanup-time flow state, metrics, notes, issue-log, runtime-derived, and plugin artifact writes. The production metadata test only compares the pre-existing target flow.json, so an implementation could still create notes, issue-log, runtime-derived, or plugin files under the target worktree and pass.
**Required change:** Add spec-local regression coverage that exercises the cleanup-time writers or finalize-cleanup write path for each required surface and asserts the resolved written paths are outside the target worktree and that the target worktree file tree is unchanged after the operation.
**Why blocking:** R1 is a must requirement, and the current tests would pass without detecting forbidden creation of non-flow files under the removable target worktree.

### 2. R2 durability requirement is not exercised by production behavior
**Target:** specs/304-finalize-cleanup-readonly/tests/finalize-cleanup-readonly.test.js
**Issue:** The R2 test only checks cleanupSurfaceOwner metadata paths and commitBoundary strings. It does not verify that retained finalize-cleanup surfaces are actually persisted or reported through the main repository FlowManager/FlowStore before the final flow.json commit, or through durable non-worktree sidecar/runtime storage after that commit.
**Required change:** Add a spec-local test that invokes the production finalize-cleanup persistence/reporting path for retained surfaces and verifies the resulting durable main-repo or sidecar artifacts are created or returned outside the target worktree at the expected commit boundary.
**Why blocking:** R2 is a must requirement, and path-owner metadata alone can pass even if no retained surface is actually persisted or reported to callers.

### 3. R6 does not prove post-final metadata avoids mutating committed flow.json
**Target:** specs/304-finalize-cleanup-readonly/tests/finalize-cleanup-readonly.test.js
**Issue:** The R6 test only asserts that resolver.postCommandMetadataPath returns paths different from main flow.json. It does not call the dispatcher/runtime or agent metric writer after a final flow snapshot, does not compare the committed flow.json contents before and after, and does not verify durable sidecar writes occur.
**Required change:** Add a spec-local production-path test that seeds a final main flow.json snapshot, invokes post-command runtimeLog completion and agent metric writes, asserts flow.json remains byte-for-byte unchanged, and asserts the runtime/metric sidecar files are written outside the target worktree.
**Why blocking:** R6 is a must requirement, and the current test would pass with an implementation that exposes sidecar path helpers but still mutates final flow.json during post-command completion.


## Advisory Findings

### 1. R3 dirty-submodule coverage is simulated through stderr only
**Target:** specs/304-finalize-cleanup-readonly/tests/finalize-cleanup-readonly.test.js
**Improvement:** Consider adding a higher-fidelity fixture or command-level assertion for initialized dirty submodule cleanup once the implementation surface supports it. The current mock verifies --force retry semantics but does not model submodule state beyond an error string.
**Why non-blocking:** The must requirement is primarily that --force reaches git worktree remove, and the current test covers that command behavior for both dirty-root and dirty-submodule scenarios.
