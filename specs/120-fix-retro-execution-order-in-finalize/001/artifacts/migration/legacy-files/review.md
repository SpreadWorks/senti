# Code Review Results

### [x] Now I have a clear picture of the changes. Let me produce the proposals.
---

**Verdict:** APPROVED
**Reason:** This is a genuine correctness bug, not cosmetic. The documentation claims 5 steps (`commit → merge → sync → cleanup → record`) while the implementation now has 6 steps with retro inserted at position 3. Both the summary table (line 42) and the detail section (line 256) are factually wrong. Users consulting the docs for `--steps` numbers will pass incorrect values. The `{{text}}` block needs regeneration or manual correction.

### [ ] 1. Stale step sequence and count in `cli_commands.md`
**File:** `docs/cli_commands.md`
**Issue:** The AI-regenerated text for `flow run finalize` still describes the old 5-step pipeline. The summary table row says `commit → merge → sync → cleanup → record` and the detail section says *"up to five steps: (1) commit, (2) merge, (3) run `flow run sync`, (4) clean up, (5) record"*. The implementation now has six steps: commit → merge → **retro** → sync → cleanup → record.
**Suggestion:** Regenerate or manually correct the `{{text}}` block for this command to read "up to six steps: (1) commit, (2) merge, (3) run retro, (4) run `flow run sync`, (5) clean up, (6) record."

---

**Verdict:** REJECTED
**Reason:** The retro step is fundamentally different from other steps — it's the only step whose subprocess output contains structured data (a summary) worth surfacing in the finalize envelope. The other steps either succeed/fail with no useful payload (cleanup, record) or have their own status fields (commit message, merge strategy). Extracting a shared helper for a single use case is premature abstraction. The try/catch is appropriately defensive for parsing external process output and the pattern is readable as-is. Simplifying to `{ status: "done" }` would discard useful data that the SKILL.md explicitly tells the agent to display.

### [x] 2. Retro result parsing is a one-off inconsistent pattern in `finalize.js`
**File:** `src/flow/run/finalize.js`
**Issue:** Every other step sets `results.<step> = { status: "done" }` on success without touching subprocess stdout. The new retro step uniquely parses stdout JSON and conditionally spreads a `summary` field into the result:
```js
let retroData;
try { retroData = JSON.parse(retroRes.stdout); } catch (_) { retroData = null; }
results.retro = { status: "done", ...(retroData?.data?.summary ? { summary: retroData.data.summary } : {}) };
```
This adds a bespoke try/catch+spread pattern not shared with any other step, making maintenance harder and the code noisier.
**Suggestion:** Either (a) simplify to `results.retro = { status: "done" }` (the summary is available via `flow get status` anyway), or (b) extract a small helper `parseStepPayload(stdout)` that all steps can call consistently for structured results.

---

**Verdict:** APPROVED
**Reason:** This is a real DRY violation with concrete risk — the PR itself required a coordinated update of both `STEP_MAP` and the `new Set([...])` literal. Deriving from `STEP_MAP` with `new Set(Object.keys(STEP_MAP).map(Number))` is a one-line change that eliminates a guaranteed future maintenance hazard with zero behavioral risk.

### [x] 3. `activeSteps` hardcoded set duplicates `STEP_MAP` keys
**File:** `src/flow/run/finalize.js`
**Issue:** `STEP_MAP` is the authoritative source of valid step numbers, but the `--mode all` branch independently hardcodes the same set:
```js
const STEP_MAP = { 1: "commit", 2: "merge", 3: "retro", 4: "sync", 5: "cleanup", 6: "record" };
// ...
activeSteps = new Set([1, 2, 3, 4, 5, 6]);  // must be kept in sync manually
```
Adding or removing a future step requires updating both places; when this PR added step 3 (retro), the `new Set([…])` call needed a matching update and could silently diverge.
**Suggestion:** Derive the set from the map:
```js
activeSteps = new Set(Object.keys(STEP_MAP).map(Number));
```

---

**Verdict:** APPROVED
**Reason:** Same category as proposal #3 — the string `"no valid steps. valid: 1,2,3,4,5,6"` must be manually synchronized with `STEP_MAP`. Generating it with `Object.keys(STEP_MAP).join(",")` is trivial, safe, and eliminates another drift point. This is not cosmetic; it directly affects the correctness of user-facing error messages.

### [x] 4. Error message for invalid steps is a magic string
**File:** `src/flow/run/finalize.js`
**Issue:** The error message lists valid steps as a hardcoded string `"no valid steps. valid: 1,2,3,4,5,6"`. This will drift again next time `STEP_MAP` changes.
**Suggestion:** Generate it from `STEP_MAP`:
```js
output(fail("run", "finalize", "INVALID_STEPS",
  `no valid steps. valid: ${Object.keys(STEP_MAP).join(",")}`));
```

---

**Verdict:** APPROVED
**Reason:** This is a real behavioral change that deserves explicit acknowledgement. Looking at the current code: `EXCLUDE_FIELDS` includes `"detail"`, so `filterEntry` drops it. But the removed `toSearchResult` explicitly included `detail: e.detail || null`, and `fallbackSearch` / `aiSearch` / `searchEntries` all still manually include `detail` in their return objects (lines 37, 115, 176) — they don't use `filterEntry` at all. So `detail` is actually still present in search results through the inline projections. The proposal's premise that search results now lose `detail` is **partially incorrect** for the current code, but the broader point stands: there are now two inconsistent projection patterns in the same file (inline objects that include `detail` vs. `filterEntry` that excludes it), and a code comment on `EXCLUDE_FIELDS` noting its scope would prevent future confusion when someone tries to consolidate them.

### [ ] 5. `toSearchResult` removal exposes that `filterEntry` excludes `detail`; original inclusion may have been intentional
**File:** `src/flow/get/context.js`
**Issue:** The now-deleted `toSearchResult` explicitly **included** `detail` in search results (`detail: e.detail || null`). The `filterEntry` function that replaced it explicitly **excludes** `detail` (it is in `EXCLUDE_FIELDS`). Since all search paths — both `aiSearch` and the former `ngramSearch` — now funnel through `filterEntry`, `detail` is silently dropped from every search result. If callers relied on `detail` being present, this is a silent regression.
**Suggestion:** Confirm whether `detail` should appear in `flow get context` search results. If yes, remove `"detail"` from `EXCLUDE_FIELDS` (or add a separate allow-list path for search results). If no, add a code comment to `EXCLUDE_FIELDS` noting that this also affects search output, to prevent future confusion.

**Verdict:** REJECTED
**Reason:** No verdict provided
