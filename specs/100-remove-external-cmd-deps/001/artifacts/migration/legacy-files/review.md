# Code Review Results

### [x] 1. Extract Git/GitHub probing into a shared helper
**File:** `src/flow/get/resolve-context.js`
**Issue:** `resolve-context.js` now contains five near-identical `execFileSync(...)/try-catch` blocks for Git and `gh` inspection. The same worktree cleanliness check is also duplicated in `src/flow/run/prepare-spec.js`. This spreads shell-command knowledge across the codebase and makes future changes error-prone.
**Suggestion:** Move this logic into a shared module such as `src/lib/git-state.js` with small helpers like `tryExec()`, `getWorktreeStatus()`, `getCurrentBranch()`, `getAheadCount()`, `getLastCommit()`, and `isGhAvailable()`. Reuse those helpers from both `resolve-context.js` and `prepare-spec.js`.

**Verdict:** APPROVED
**Reason:** The diff clearly shows two files (`resolve-context.js` and `prepare-spec.js`) both importing `execFileSync` directly and running near-identical `git status --short` try/catch blocks. This is genuine duplication of shell-command knowledge, not cosmetic. Centralizing into `src/lib/git-state.js` with small focused helpers reduces the risk of inconsistent error handling and makes future Git interaction changes single-point. The project's "no external dependencies" rule is respected since it uses only Node.js built-ins.

### [x] 2. Replace text parsing with count-oriented Git commands
**File:** `src/flow/get/resolve-context.js`
**Issue:** `aheadCount` is computed via `git log <base>..HEAD --oneline` and then counted by splitting lines. This is more parsing than needed and couples the code to a human-readable format.
**Suggestion:** Use `git rev-list --count <base>..HEAD` for `aheadCount`. It is simpler, faster, and returns the exact numeric value the code needs.

**Verdict:** APPROVED
**Reason:** `git rev-list --count <base>..HEAD` is the purpose-built command for this and eliminates the split/filter/length chain on `--oneline` output. It's a strictly correct substitution — same semantics, fewer failure modes (e.g., commit messages containing newlines in exotic configs), and marginally faster. No behavior change risk.

### [ ] 3. Rename or normalize `dirtyFiles`
**File:** `src/flow/get/resolve-context.js`
**Issue:** `dirtyFiles` is misleadingly named because it stores raw `git status --short` lines, not just file paths. Consumers have to understand Git porcelain output format implicitly.
**Suggestion:** Either rename it to something explicit like `dirtyStatusLines`, or normalize it into structured objects such as `{ status, path }` before returning JSON. That would make downstream skill/template logic clearer and more consistent.

**Verdict:** REJECTED
**Reason:** The current consumers (skill templates like `flow-status` and `flow-finalize`) use `dirtyFiles` to display file count and list — both work fine with raw `git status --short` lines, which are a well-understood format. Renaming to `dirtyStatusLines` is cosmetic churn. Normalizing into `{ status, path }` objects adds parsing complexity and creates a new internal schema that must be maintained, with no demonstrated downstream benefit. The project's alpha-stage policy favors pragmatism over premature abstraction.

### [ ] 4. Centralize worktree-aware environment setup
**File:** `src/flow/run/review.js`
**Issue:** The `SDD_WORK_ROOT` setup is embedded directly in `review.js`. If other flow commands need the same worktree-to-main-repo resolution, this pattern will be duplicated.
**Suggestion:** Introduce a helper such as `buildWorktreeEnv(root)` in `src/lib/cli.js` or `src/lib/process.js`, and reuse it wherever commands need main-repo context while running from a worktree.

**Verdict:** REJECTED
**Reason:** The diff shows this pattern exists in exactly one place (`review.js`). The proposal is speculative — "if other flow commands need the same..." — but there's no current duplication. The project explicitly avoids over-engineering ("過剰な防御コードを書かない"). Extracting a `buildWorktreeEnv()` helper for a single call site adds indirection without proven reuse. Revisit when a second consumer actually appears.

### [x] 5. Remove or demote obsolete public command entry points
**File:** `src/flow/registry.js`
**Issue:** Public flow commands were renamed from `merge`/`cleanup` to `finalize`/`sync`, but the old implementation files likely still exist. If they remain as standalone scripts without registry exposure, they become dead or semi-private code with unclear ownership.
**Suggestion:** If `src/flow/run/merge.js` and `src/flow/run/cleanup.js` are no longer intended as public commands, either delete them or convert them into clearly internal helpers used by `finalize.js`. That keeps the command surface and implementation structure aligned.

**Verdict:** APPROVED
**Reason:** The registry diff clearly shows `merge.js` and `cleanup.js` being replaced by `finalize.js` and `sync.js` in the command surface. Per the project's alpha policy ("旧フォーマット・非推奨パスは保持せず削除する"), old files should not linger. Leaving orphaned scripts creates confusion about the public API and risks accidental direct invocation. They should be deleted or explicitly converted to internal helpers called by the new commands.

### [ ] 6. Reduce command-execution API branching in `runSync`
**File:** `src/lib/process.js`
**Issue:** `runSync` is growing ad hoc option forwarding (`timeout`, now conditional `env`). As more callers need custom process options, this pattern tends to accumulate one-off spreads.
**Suggestion:** Simplify the wrapper by forwarding a curated options object directly, for example building a single `spawnSync` options map from defaults plus supported overrides. This keeps the process wrapper consistent and avoids repeated incremental patches whenever a new option is needed.

**Verdict:** REJECTED
**Reason:** The diff shows `runSync` adding exactly one new conditional spread (`opts.env && { env: opts.env }`). The current wrapper is 10 lines and deliberately curates which `spawnSync` options are forwarded — this is a feature, not a problem. The proposal to forward a "curated options object" is essentially describing what the code already does. Refactoring this now is premature; the wrapper is still small and readable. The risk of accidentally passing through unsafe options (e.g., `shell: true`) by making forwarding more permissive outweighs the marginal DRY benefit.
