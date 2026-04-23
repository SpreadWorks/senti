# Code Review Results

### [x] 1. Normalize terminology for tool names and paths
**File:** `src/templates/partials/worktree-mode.md`  
**Issue:** The new rule mixes terms like `Edit/Write tool calls`, `main repo absolute path`, and `worktree equivalent`, which can be interpreted inconsistently.  
**Suggestion:** Standardize wording to one vocabulary set (e.g., `edit/write tools`, `main-repo path`, `worktreePath`) and use those terms consistently in all sentences of the bullet.

**Verdict:** APPROVED
**Reason:** This reduces ambiguity in a safety-critical rule (path handling in worktree mode) and is not behavior-changing if meaning stays identical.

### [ ] 2. Remove duplicated phrasing in the new MUST rule
**File:** `src/templates/partials/worktree-mode.md`  
**Issue:** The added bullet repeats the same idea multiple times (`main repo`, `outside the worktree`, `rewrite to worktree equivalent`), which makes the rule longer than necessary.  
**Suggestion:** Collapse it into a single normative statement plus one short exception pattern, e.g., “Only pass relative paths from worktree cwd or absolute paths under `worktreePath`; reject all other absolute paths.”

**Verdict:** REJECTED
**Reason:** The proposed compression risks dropping important operational detail (especially the rewrite requirement for Read/Grep-derived main-repo paths), which can weaken the guard and lead to misuse.

### [x] 3. Split the long MUST item into rule + rationale for readability
**File:** `src/templates/partials/worktree-mode.md`  
**Issue:** The added line combines policy, rationale, examples, and remediation in one dense bullet, reducing scanability compared with surrounding bullets.  
**Suggestion:** Keep the MUST line short, then move rationale/example into a second sentence (or continuation line) so the policy is immediately clear and consistent with the existing list style.

**Verdict:** APPROVED
**Reason:** Separating normative rule from rationale improves scanability without changing intent, as long as all existing constraints/examples remain intact.
