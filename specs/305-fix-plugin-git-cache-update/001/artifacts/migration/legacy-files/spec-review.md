# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Cache deletion target is not safely specified
**Target:** R3 / T-2 dirty managed cache self-heal
**Issue:** The spec requires deleting and recloning unrecoverable managed Git URL caches, but existing code builds the cache path from config-controlled source.id via .senti/plugin-sources/<source.id> and does not currently validate that id or confine the resolved path before destructive operations.
**Required change:** Add a spec-level requirement that any reset/clean/delete/reclone self-heal operation must validate or normalize the Git URL cache path and only operate when the resolved path is inside .senti/plugin-sources/ for the current root; unsafe source ids or paths must be rejected.
**Why blocking:** Without this, implementing the required fallback with fs.rmSync or equivalent can delete paths outside the managed cache when a config contains a path-traversal source.id, making the self-heal behavior unsafe to implement.

### 2. Resolved tree consistency is not required for metadata consumers
**Target:** R1/R2/R5 / src/lib/plugin-registry.js resolveSource consumers
**Issue:** Existing addPluginRepo, findPluginCandidates, installPlugin, and installFromSource read plugin.json or validate files from resolved.root, not only from the resolved commit. The spec requires adopting the resolved commit, but does not explicitly require the returned source root or materialized tree to match that commit before those consumers read metadata.
**Required change:** Add a requirement that Git URL resolveSource/syncGitUrlSource must provide a source root or materialized package tree whose files correspond to the resolved target commit before PluginManifest, validateSourceTree, find, add, or install paths inspect it.
**Why blocking:** Otherwise an implementation can return a new commit while public commands still validate or discover plugin metadata from stale cache contents, producing mixed old-tree/new-commit behavior that tests cannot reliably define for add/find/install parity.


## Non-blocking Improvements

### 1. Clarify ambiguous ref precedence
**Target:** R2
**Improvement:** Specify the intended behavior when source.ref names collide across branch and tag names, and whether abbreviated SHAs are intentionally out of scope while 40-character SHAs are supported.
**Why non-blocking:** The main branch, tag, and full-SHA behavior is testable as written; this only improves determinism for edge cases.

### 2. Improve related-file context
**Target:** Codebase Context
**Improvement:** List src/lib/plugin-registry.js near the top of related files, since it is the main implementation target and many current related entries are unrelated data-source modules.
**Why non-blocking:** The spec body already names plugin-registry.js and its relevant functions, so implementation is not blocked.
