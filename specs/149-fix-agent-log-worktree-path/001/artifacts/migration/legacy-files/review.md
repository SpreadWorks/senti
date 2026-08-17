# Code Review Results

### [x] 1. Repeated `before`/`after` tmp lifecycle in test file
**File:** `specs/149-fix-agent-log-worktree-path/tests/resolve-log-dir.test.js`

**Issue:** The `let tmp` / `before(() => { tmp = createTmpDir(...) })` / `after(() => { removeTmpDir(tmp) })` pattern is copy-pasted verbatim across all 4 `describe` blocks. Each block only differs in the prefix string passed to `createTmpDir`.

**Suggestion:** Extract into a reusable `useTmpDir` helper (can live in `tests/helpers/`) that wraps the lifecycle registration and returns a getter:

```js
function useTmpDir(prefix) {
  let dir;
  before(() => { dir = createTmpDir(prefix); });
  after(() => { removeTmpDir(dir); });
  return () => dir;
}

// Usage:
describe("resolveLogDir — req0: ...", () => {
  const tmp = useTmpDir("sdd-149-req0-");
  it("...", () => {
    const result = resolveLogDir(tmp(), cfg);
    // ...
  });
});
```

---

**Verdict:** APPROVED
**Reason:** The `let tmp / before / after` pattern is genuinely copy-pasted verbatim across all 4 `describe` blocks — exactly the DRY threshold the project's own coding rules cite ("same pattern in 2+ places → extract helper"). The `useTmpDir` closure approach is idiomatic for `node:test`, returns a getter that defers access until tests run, and carries zero risk of breaking test behavior since it is a mechanical extraction of identical lifecycle code. Placing it in `tests/helpers/` keeps it accessible without polluting production source.

### [ ] 2. `createWorktreeSetup` should move to shared test helpers
**File:** `specs/149-fix-agent-log-worktree-path/tests/resolve-log-dir.test.js`

**Issue:** `createWorktreeSetup` initializes a real git repo and attaches a worktree via `git worktree add`. This is a non-trivial, generally useful setup for any spec test that needs to exercise worktree-aware code. Keeping it inline in a single spec test file makes it invisible to future tests with the same need.

**Suggestion:** Move `createWorktreeSetup` to `tests/helpers/worktree.js` and export it:

```js
// tests/helpers/worktree.js
export function createWorktreeSetup(baseDir) { ... }
```

Import in this test and any future test that needs a worktree fixture.

---

**Verdict:** REJECTED
**Reason:** The proposal is forward-looking ("makes it visible to future tests") but no such future test exists yet. Per the project's own guardrail — "don't write code in anticipation of needs that haven't materialized" — extracting a helper for a single consumer creates an abstraction without a second use case to justify it. The function is also tightly coupled to the specific git configuration steps needed by *this* spec (user.email, single initial commit, `wt-branch` name). A generic `tests/helpers/worktree.js` would either over-specify these details or require a config parameter that makes it more complex than the inline version. Promote it when a second caller actually needs it.

### [x] 3. Variable name `base` in `resolveLogDir` is too generic
**File:** `src/lib/agent-log.js`

**Issue:** The new variable `base` introduced in `resolveLogDir` carries significant semantic meaning — it is the root of the repository where logs should land (either the main repo root or the current working directory). The name `base` does not convey that.

**Suggestion:** Rename to `repoRoot` to make the intent explicit:

```js
export function resolveLogDir(cwd, cfg) {
  if (cfg?.logs?.dir) return cfg.logs.dir;
  const workDir = cfg?.agent?.workDir || ".tmp";
  const root = path.resolve(cwd || process.cwd());
  const repoRoot = isInsideWorktree(root) ? getMainRepoPath(root) : root;
  return path.join(repoRoot, workDir, "logs");
}
```

**Verdict:** APPROVED
**Reason:** This is not cosmetic — `base` is genuinely ambiguous (it could mean "base path", "base directory for path.join", etc.) while `repoRoot` precisely communicates the semantic: the root of the repository that will anchor the log directory. The rename is a zero-risk single-variable change within a 4-line function, improves readability for anyone auditing the worktree-detection logic, and aligns with the naming already used in surrounding code (`getMainRepoPath`, `isInsideWorktree`). No behavioral change.
