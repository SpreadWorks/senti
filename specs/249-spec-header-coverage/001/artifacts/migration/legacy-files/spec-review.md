# Spec Review Results

## Proposals

### 1. I’ll inspect the related modules and nearby references to `test-map`, requirement coverage, and prompt/schema usage, then map those back to the spec for omissions.The `.tmp` directory itself is empty apart from the sibling spec worktree artifacts, so I’m checking the worktree layout before searching the actual source path.The source tree is one level up within the same worktree. I’m going to search from that root so the review includes actual callers, tests, and generated skill/template references.I found the current implementation still has `test-map.json` wired through `run-retro`, `review`, and `req-map`. Next I’m checking prompt/template copies and tests, because those are the common places specs miss when removing a workflow artifact.### 1. Clarify Empty Mapping Precedence
**File:** `src/flow/lib/run-retro.js`  
**Issue:** R5 says empty header mapping returns `null` and falls back to AI, while R12(c) says all-`testable:false` specs must return deterministic static output with empty `requirements[]`.  
**Suggestion:** Specify precedence: compute testable requirements first; if count is `0`, return static retro immediately before applying the “empty mapping → AI fallback” rule.

### 2. 2. Resolve `.ts` Discovery vs Runner
**File:** `src/flow/lib/run-retro.js`  
**Issue:** Discovery includes `.{test,spec}.ts`, but retro still runs `node --test` directly. This package supports Node >=18 and has no TS loader dependency, while runner externalization is out of scope.  
**Suggestion:** Limit retro-executed files to `.js`/`.mjs`, or explicitly define `.ts` files as validation-only and AI-fallback until dcb2.

### 3. 3. Define AI Retro Response Alignment
**File:** `src/flow/lib/run-retro.js`  
**Issue:** R6 says AI input includes non-testable requirements but `parseRetroResponse` filters them out. Current AI schema has no requirement ID, and `buildRetroPrompt` also emits a desc-only “Requirements List”, so positional filtering can misalign statuses.  
**Suggestion:** Require either requirement IDs in the AI response schema, or a strict original-index mapping strategy before filtering `testable:false` items.

### 4. 4. Update Test Coverage Guardrail
**File:** `src/presets/base/guardrail.json`  
**Issue:** The `spec-test-coverage` guardrail still says test code MUST exist under `specs/<specid>/tests/` and all tests must pass. That contradicts `requirements[].testable:false` and the all-non-testable no-test path.  
**Suggestion:** Add this file to scope, revising the guardrail to require spec verification tests only for testable requirements and to recognize the header/testable exemption.

### 5. 5. Define Header Scan Window
**File:** `src/flow/lib/test-headers.js`  
**Issue:** R1 says headers appear “near the top” and allows shebang/license/TODO comments, but does not define where header scanning stops. This makes malformed detection for comments containing `spec` ambiguous.  
**Suggestion:** Define a concrete scan window, e.g. shebang plus leading blank/comment lines until the first non-comment code line, or a fixed max-line prefix.

### 6. 6. Reconcile Regex Scan With Comment Exclusions
**File:** `src/flow/lib/test-headers.js`  
**Issue:** R4 says test-name detection is line-regex based, but also says comment lines and nested template literals are excluded. Without an AST/parser dependency, template-literal exclusion is underspecified.  
**Suggestion:** Either require a small lexical scanner, or simplify the rule to ignore only obvious full-line comments and accept other regex false positives.
