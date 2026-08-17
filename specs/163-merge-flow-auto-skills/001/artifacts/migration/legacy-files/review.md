# Code Review Results

### [x] Based on my analysis of the actual committed code against the review.md file (which contains 4 APPROVED proposals), all 4 approved changes were **not applied** to the code. Here are the concrete proposals:
---

**Verdict:** APPROVED
**Reason:** The committed code literally introduced this regression: `SKILL_TARGET_BASES` is declared as a named constant to express intent, but then accessed by opaque numeric indices (`[0]`, `[1]`). The destructuring `const [agentsBase, claudeBase] = SKILL_TARGET_BASES` makes the semantic pairing explicit at the declaration site with zero behavior change. If the array order ever changes, the positional index access fails silently; the destructured names make the mismatch immediately visible.

### [x] 1. Fragile Index-Based Access to `SKILL_TARGET_BASES`
**File:** `src/lib/skills.js`
**Issue:** `deploySkillsFromDir` uses positional index access (`SKILL_TARGET_BASES[0]`, `SKILL_TARGET_BASES[1]`) to derive `agentsSkillsDir` and `claudeSkillsDir`. If the array order changes, the semantic mapping silently breaks with no signal at compile or runtime.
**Suggestion:** Destructure at the call site to make the intent explicit:
```js
const [agentsBase, claudeBase] = SKILL_TARGET_BASES;
const agentsSkillsDir = path.join(workRoot, agentsBase, "skills");
const claudeSkillsDir = path.join(workRoot, claudeBase, "skills");
```
*(This was APPROVED in `specs/163-merge-flow-auto-skills/review.md` Proposal 1 but not applied.)*

---

**Verdict:** APPROVED
**Reason:** Both exports are single-line pass-throughs to `deploySkillsFromDir` differing only in whether `templatesDir` is hardcoded. Worse, their positional parameter orders differ (`workRoot, lang` vs. `workRoot, templatesDir, lang`), forcing callers to reason about two calling conventions for the same operation. The proposed single export with `opts.templatesDir` is strictly cleaner: one export, one consistent parameter order, default applied internally. The caller change in `upgrade.js` is minimal (`{ templatesDir: expDir }`). The project's alpha policy explicitly permits removing deprecated exports, so eliminating `deployProjectSkills` is within policy.

### [x] 2. `logSkillResults` Catch-All `else` Branch Silently Swallows Unknown Statuses
**File:** `src/upgrade.js`
**Issue:** The `else` branch logs "unchanged" for **any** status that isn't `"updated"` — including the new `"removed"` status introduced in this same diff. If `logSkillResults` is ever called with a result carrying `"removed"`, the output will silently mislabel it as "unchanged".
**Suggestion:** Use explicit equality checks with a hard fail-fast guard for unknown values:
```js
function logSkillResults(results) {
  for (const { name, status } of results) {
    if (status === "updated") {
      console.log(t("ui:upgrade.skillUpdated", { name }));
    } else if (status === "unchanged") {
      console.log(t("ui:upgrade.skillUnchanged", { name }));
    } else {
      throw new Error(`unexpected skill status: ${status}`);
    }
  }
}
```
*(This was APPROVED in `specs/163-merge-flow-auto-skills/review.md` Proposal 3 but not applied.)*

---

**Verdict:** APPROVED
**Reason:** The committed `logSkillResults` uses a catch-all `else` that logs "unchanged" for *any* status that isn't `"updated"` — including the `"removed"` status introduced in the same diff. If `logSkillResults` is ever called with removal results, it silently mislabels them as "unchanged". The proposed explicit three-branch form with a `throw` is correct fail-fast design: valid statuses (`"updated"`, `"unchanged"`) are handled explicitly, and any future unexpected status surfaces immediately as a programming error rather than corrupting the log output. No behavior change for valid inputs.

### [x] 3. `skillResults.push(...expResults)` Is a Side-Effect-Driven Accumulator
**File:** `src/upgrade.js`
**Issue:** Experimental results are pushed into `skillResults` (line 95) purely so that the `hasChanges` predicate (line 120) can run `.some()` across all deploy results in one pass. This gives `skillResults` two unrelated semantic roles — per-skill logging output and aggregate change detection — while mixing heterogeneous result shapes (deploy results vs. removal results).
**Suggestion:** Replace the mutation with an explicit boolean accumulator:
```js
let anyUpdated = skillResults.some((r) => r.status === "updated");

if (config.experimental?.workflow?.enable === true) {
  const expDir = path.join(root, "experimental", "workflow", "templates", "skills");
  validTemplatesDirs.push(expDir);
  const expResults = deployProjectSkills(root, expDir, config.lang, { dryRun });
  logSkillResults(expResults);
  anyUpdated ||= expResults.some((r) => r.status === "updated");
}

const hasChanges = anyUpdated || removedSkills.length > 0;
```
*(This was APPROVED in `specs/163-merge-flow-auto-skills/review.md` Proposal 4 but not applied.)*

---

**Verdict:** APPROVED
**Reason:** The `push` into `skillResults` serves one purpose — enabling the `hasChanges` predicate to run `.some()` across all results in one pass — but it gives `skillResults` two unrelated semantic roles: per-skill logging input and aggregate change detection input. This is an implicit contract with no locality. The proposed explicit `anyUpdated` boolean accumulator tracks exactly the one property the predicate needs, the `removedSkills.length > 0` check is self-documenting, and `skillResults` remains scoped to the main deploy step. Zero behavior change, significantly clearer intent.

### [ ] 4. `deploySkills` and `deployProjectSkills` Are Redundant Wrappers with Inconsistent Parameter Order
**File:** `src/lib/skills.js`
**Issue:** Both exports are single-line pass-throughs to `deploySkillsFromDir`. They differ only in whether `templatesDir` is hardcoded — but use different positional parameter orders (`workRoot, lang` vs. `workRoot, templatesDir, lang`), forcing callers to reason about two calling conventions for the same underlying operation.
**Suggestion:** Collapse into a single export with an `opts.templatesDir` override, defaulting to `MAIN_SKILLS_TEMPLATES_DIR`:
```js
export function deploySkills(workRoot, lang, opts = {}) {
  return deploySkillsFromDir({
    templatesDir: opts.templatesDir ?? MAIN_SKILLS_TEMPLATES_DIR,
    workRoot,
    lang,
    dryRun: opts.dryRun,
  });
}
```
Remove `deployProjectSkills` entirely. The caller in `upgrade.js` passes `{ templatesDir: expDir }` for the experimental case. The alpha-period policy explicitly permits removing deprecated exports.
*(This was APPROVED in `specs/163-merge-flow-auto-skills/review.md` Proposal 2 but not applied.)*

**Verdict:** REJECTED
**Reason:** No verdict provided
