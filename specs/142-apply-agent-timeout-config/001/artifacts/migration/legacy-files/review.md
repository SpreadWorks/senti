# Code Review Results

### [x] 1. ### 1. Reuse agent timeout resolution in review flow
**File:** `src/flow/lib/run-review.js`  
**Issue:** This file still performs its own `ctx.config?.agent?.timeout` to milliseconds conversion. That duplicates logic now centralized in `resolveAgent` and weakens the design goal of having one timeout resolution path.  
**Suggestion:** Load the resolved agent for the review command and use `agent.timeoutMs` directly, or extract a shared helper such as `resolveAgentTimeoutMs(cfg, commandId)` so `run-review.js` does not reimplement conversion and fallback logic.

2. ### 2. Remove redundant timeout fallbacks at call sites
**File:** `src/docs/commands/enrich.js`  
**Issue:** `const timeoutMs = agent.timeoutMs || DEFAULT_AGENT_TIMEOUT_MS;` duplicates fallback behavior already handled inside `callAgent` / `callAgentAsync`. Similar redundancy exists in other updated command paths.  
**Suggestion:** Pass `agent.timeoutMs` directly and let the agent layer own the defaulting behavior. If a caller truly needs an eager resolved value for logging, use a small shared helper instead of repeating `|| DEFAULT_*` patterns.

3. ### 3. Align timeout naming and semantics across layers
**File:** `src/lib/agent.js`  
**Issue:** The API now mixes `timeoutMs` as both an optional function argument and a resolved property on `agent`, with fallback logic based on falsy checks. That makes the precedence rules harder to read and leaves edge cases like `0` semantically ambiguous.  
**Suggestion:** Introduce a dedicated helper such as `resolveTimeoutMs(explicitTimeoutMs, agent)` and use nullish checks (`??`) where appropriate. This would make precedence explicit, reduce duplication between sync/async paths, and avoid relying on generic falsy behavior.

4. ### 4. Remove tests that lock in invalid configuration behavior
**File:** `tests/unit/lib/agent.test.js`  
**Issue:** New tests explicitly preserve `agent.timeout = 0` and string-number coercion, even though the spec says invalid values are rejected by validation and config is expected to be numeric. These tests codify behavior for unsupported inputs and make future cleanup harder.  
**Suggestion:** Drop the `timeout: 0` and string coercion cases, and keep tests focused on supported inputs: valid numeric timeout and missing timeout fallback. If boundary handling is needed, test it at the validation layer instead.

5. ### 5. Avoid duplicating static file lists for timeout policy checks
**File:** `tests/e2e/142-agent-timeout-config.test.js`  
**Issue:** The static analysis test hardcodes a list of command files to scan. That creates maintenance duplication and can miss future command modules that reintroduce inline timeout conversion.  
**Suggestion:** Discover target files dynamically, for example by scanning `src/docs/commands/` and relevant `src/flow/lib/` files, or by extracting a shared test helper for policy-based source checks. This keeps the rule consistent as the command surface grows.

**Verdict:** APPROVED
**Reason:** `run-review.js` is the only file that still does its own `ctx.config?.agent?.timeout` → ms conversion inline, directly contradicting the spec's goal of centralizing timeout resolution in `resolveAgent`. Every other command file was updated to use `agent.timeoutMs`, but this one reimplements the conversion and fallback. The fix is straightforward: call `resolveAgent` (or `loadAgentConfig`) and use `agent.timeoutMs`. This is a genuine consistency gap, not cosmetic.
