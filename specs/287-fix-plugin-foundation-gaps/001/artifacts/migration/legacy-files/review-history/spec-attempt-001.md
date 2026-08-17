# Spec Review Results

## Verdict: FAIL

## Blocking Findings

### 1. Spec-local artifact read path is omitted
**Target:** R4 / AC7 / T-4
**Issue:** The existing public hook artifact helper in src/lib/plugin-registry.js exposes readJson in addition to writeJson and writeText, and existing plugin foundation contract hooks use readJson for read-modify-write artifact flows. The spec only requires spec-local storage for writeJson/writeText, leaving readJson's storage root undefined after moving writes from .senti/plugin-artifacts to specs/<spec>/plugin-artifacts.
**Required change:** Extend R4/AC7/T-4 to state that context.artifacts.readJson reads from the same specs/<spec>/plugin-artifacts/<pluginId>/ root and preserves its fallback behavior for missing files.
**Why blocking:** Without this, an implementation can satisfy the written acceptance by moving only writes while readJson still reads .senti/plugin-artifacts, breaking existing hook read-modify-write behavior and leaving tests without an observable basis for the existing read data path.


## Non-blocking Improvements

### 1. Clarify import forms covered by the boundary check
**Target:** R1 / AC1
**Improvement:** Clarify whether the pre-import core-internal check covers only static import/export specifiers, dynamic import string literals, absolute file paths, and/or relative paths that resolve outside the installed plugin package. Also state that Node built-in imports remain allowed if that is intended.
**Why non-blocking:** The current requirement is implementable using a representative core-internal relative import, but the clarification would reduce interpretation drift without changing the scope.

### 2. Name the old shared artifact assertions
**Target:** R5 / specs/286-plugin-foundation-runtime/tests/plugin-foundation-contract.test.js
**Improvement:** Mention that the shared plugin foundation contract tests currently assert .senti/plugin-artifacts paths and should be updated only where they encode the corrected flow-hook artifact contract.
**Why non-blocking:** The spec already allows shared test updates for production contract changes, so this is useful implementation context rather than a blocker.
