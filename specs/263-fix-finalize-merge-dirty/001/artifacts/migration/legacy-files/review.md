# Code Review Results

### 1. 1. Bound dirty status parsing
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `parsePorcelainStatusPaths()` splits the entire `git status -z` output and accumulates every dirty path with no explicit size/count bound. The matched rationale bounds allowed metadata paths to 2, but it does not bound the status output itself.  
**Suggestion:** Stop collecting all paths once an external dirty path is found, or parse status records against the fixed two-path allowlist and return early. This keeps resource usage tied to the decision being made.

### 2. 2. Remove or use the unused exported helper
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `hasFinalizeMergeTargetExternalDirty()` is added but not used in the diff. It is a thin wrapper over `getFinalizeMergeTargetExternalDirtyPaths()` and may become dead API surface.  
**Suggestion:** Either remove it, or use it from `src/flow/registry.js` if callers only need a boolean. Keep only the helper shape that is actually needed.

### 3. 3. Avoid duplicate external-dirty filtering
**File:** `src/flow/registry.js`  
**Issue:** The pre-hook computes `externalDirtyPaths` before mutation, then `commitFinalizeMergeMetadataIfSafe()` recomputes the same allowed-path set and external-dirty filtering using the same `dirtyPaths`.  
**Suggestion:** Add a small preflight result helper in `run-finalize.js`, for example returning `{ dirtyPaths, externalDirtyPaths }`, and pass that through. This removes duplicated filtering and keeps the pre-hook focused on flow behavior.

### 4. 4. Rename pathspec helpers to path helpers
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `finalizeMergeMetadataPathspecs()` returns exact relative file paths, not general Git pathspecs. The name makes later uses like `pathSet.has(dirtyPath)` less clear.  
**Suggestion:** Rename it to `finalizeMergeMetadataPaths()` and consider renaming `allowed` to `allowedMetadataPaths` or destructuring `{ paths, pathSet }` where used. This better matches the exact-path comparison semantics.
