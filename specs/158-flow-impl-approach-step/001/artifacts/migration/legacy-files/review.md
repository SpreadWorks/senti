# Code Review Results

### [x] Now I have enough context to provide a thorough review. Here are my proposals:
---

**Verdict:** APPROVED
**Reason:** The bug is confirmed at line 153 of `.sdd-forge/config.json`. The original `profiles.default` format had the correct spelling `experimental.workflow.board.to-issue`, but the migration to `commands` silently reintroduced `borad`. This is a functional regression: any code dispatching on the correct key `board` will miss this config entry, causing silent fallback to the default agent rather than the intended one. Not cosmetic — the wrong key is functionally dead config.

### [x] 1. Typo `borad` re-introduced in commands key
**File:** `.sdd-forge/config.json`
**Issue:** Line 153 contains `"experimental.workflow.borad.to-issue"` — this was the exact typo that spec 157 was supposed to fix (`borad` → `board`). It was corrected in the old `profiles` format but silently re-introduced when the config was migrated to the new `commands` format.
**Suggestion:** Rename the key to `"experimental.workflow.board.to-issue"`:
```json
"experimental.workflow.board.to-issue": {
  "agent": "claude", "profile": "sonnet"
}
```

---

**Verdict:** APPROVED
**Reason:** The file read confirms every value line inside the new `commands` block (lines 124, 127, 130, …) begins with a literal tab character followed by spaces, while the rest of the file uses pure spaces. This is a genuine quality defect: it breaks any JSON linter enforcing `"no-tabs"`, causes invisible misalignment in editors, and pollutes diffs. JSON parsing is unaffected, but the inconsistency is real and the fix is safe.

### [x] 2. Mixed tab/space indentation in `commands` block
**File:** `.sdd-forge/config.json`
**Issue:** Every value line inside the new `commands` block uses a tab character followed by spaces (e.g. line 124: `\t      "agent": "claude", "profile": "sonnet"`), while the rest of the file uses pure spaces. This causes inconsistent rendering in editors and diffs, and will fail any JSON linter configured to disallow tabs.
**Suggestion:** Replace all tab-prefixed lines in `commands` with consistent 8-space indentation matching the surrounding file:
```json
"docs": {
        "agent": "claude", "profile": "sonnet"
},
```

---

**Verdict:** APPROVED
**Reason:** The confirmed code (lines 595–609) peels exactly one dot-segment and stops. For a three-segment ID like `docs.review.draft` with only `"docs"` in commands (no `"docs.review"` entry), the function returns `null`, causing `resolveAgent` to fall back to `agent.default` and silently ignore the `docs` entry. This is a functional bug for any project that uses three-segment command IDs (e.g., `flow.review.draft`). The proposed iterative walk is the correct fix with no behavioral regression for the existing two-segment case.

### [ ] 3. `resolveCommandSettings` only falls back one level — misleading for deep command IDs
**File:** `src/lib/agent.js`
**Issue:** The function trims exactly one dot-segment from the commandId as its only fallback:
```js
const dotIdx = commandId.lastIndexOf(".");
if (dotIdx > 0) {
  const parent = commandId.slice(0, dotIdx);
  if (commands[parent]) return commands[parent];
}
return null;
```
For a three-segment ID like `docs.review.draft` with only `"docs"` in commands (not `"docs.review"`), the function returns `null` and `resolveAgent` silently falls back to `agent.default` — the `docs` entry is ignored. This also makes the JSDoc comment (`commands["docs.review"] → commands["docs"] → null`) accurate only for two-segment IDs, which is misleading.
**Suggestion:** Walk up the hierarchy iteratively until a match is found or all segments are exhausted:
```js
function resolveCommandSettings(commands, commandId) {
  if (!commands || !commandId) return null;
  let id = commandId;
  while (id) {
    if (commands[id]) return commands[id];
    const dotIdx = id.lastIndexOf(".");
    if (dotIdx < 0) break;
    id = id.slice(0, dotIdx);
  }
  return null;
}
```
Update the JSDoc to `Lookup order: exact → parent → grandparent → … → null`.

---

**Verdict:** REJECTED
**Reason:** The fast-path returns `{ ...provider, timeoutMs, providerKey }`, which spreads the original `provider.args` reference. The proposed replacement always goes through `mergeProfileArgs`, which returns `[...provider.args]` — a fresh copy — so `result.args !== provider.args` after the change. This is a real, if subtle, behavioral difference in reference identity. Any caller that mutates the returned `args` array (or checks identity) would be affected differently. The quality improvement is minimal (three lines, one condition), and the project's own rule is to avoid over-engineering. Conservative assessment: reject.

### [ ] 4. `resolveAgent` fast-path condition adds unnecessary complexity
**File:** `src/lib/agent.js`
**Issue:** The early-exit guard `if (!cmdSettings && !provider.profiles)` is a redundant optimization:
```js
// No profiles support in provider → return as-is
if (!cmdSettings && !provider.profiles) {
  return { ...provider, timeoutMs, providerKey: detectProviderKey(provider.command) };
}
const profileName = cmdSettings?.profile || "default";
const mergedArgs = mergeProfileArgs(provider, profileName);
```
`mergeProfileArgs` already handles both `!provider.profiles` and an empty profile array by returning `baseArgs` unchanged. The fast-path produces the exact same `...provider, args: baseArgs` result as the normal path. The condition mixes two orthogonal concerns (`cmdSettings` presence and `provider.profiles` presence) in a single branch, making the intent harder to follow.
**Suggestion:** Remove the fast-path and let `mergeProfileArgs` handle all cases uniformly:
```js
const profileName = cmdSettings?.profile || "default";
const mergedArgs = mergeProfileArgs(provider, profileName);
return { ...provider, args: mergedArgs, timeoutMs, providerKey: detectProviderKey(provider.command) };
```
This is a no-op change in behaviour (all existing tests continue to pass) but removes the dual-condition guard.

**Verdict:** REJECTED
**Reason:** No verdict provided
