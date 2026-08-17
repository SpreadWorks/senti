# Code Review Results

### [x] Based on my analysis of the diff and current file state, here are the code quality proposals:
---

**Verdict:** APPROVED
**Reason:** The diff confirms the regression. `src/templates/skills/sdd-forge.flow-plan/SKILL.md` line 96 reverts from `**MUST: Every question to the user — including confirmations after applying user-requested changes — MUST use the Choice Format. No free-form questions. No exceptions.**` back to the weaker `Use selection-based questions as default (not free-form).` This is a genuine behavioral downgrade. The `fix-agent-commands-entries` spec is scoped to `agent.commands → agent.profiles` — it has no legitimate reason to touch SKILL.md. The MUST wording was approved and implemented by a separate parallel worktree (spec 162-improve-choice-format-enforcement), and reverting it represents a merge conflict resolution that incorrectly discarded the other branch's changes.

### [x] 1. Unintended Regression: SKILL.md MUST Enforcement Downgraded
**File:** `src/templates/skills/sdd-forge.flow-plan/SKILL.md`

**Issue:** The diff reverts the strict enforcement wording added by spec `162-improve-choice-format-enforcement`. The line:

```
**MUST: Every question to the user — including confirmations after applying user-requested changes — MUST use the Choice Format. No free-form questions. No exceptions.**
```

was replaced with the weaker pre-existing text:

```
Use selection-based questions as default (not free-form). Provide options the user can pick from.
```

This is unrelated to the `agent.commands → agent.profiles` fix this spec intends to implement and reverses an approved change from a parallel worktree.

**Suggestion:** Restore the MUST wording. The fix-agent-commands-entries spec should not touch SKILL.md at all. Revert line 96 to the previously approved phrasing.

---

**Verdict:** APPROVED
**Reason:** The two removed assertions in `tests/unit/lib/skills-include.test.js` are regression guards that prevent the SKILL.md wording from being silently weakened. Their deletion is directly coupled to the SKILL.md revert in proposal #1 — since the strict phrases no longer exist in the file, the tests were deleted to avoid failure rather than fixed. This is test coverage that should be preserved. If the SKILL.md revert is corrected (proposal #1), these assertions must be restored. Removing them without replacement reduces the project's ability to detect future regressions.

### [x] 2. Dead Code: Test Assertions Removed Without Replacement
**File:** `tests/unit/lib/skills-include.test.js`

**Issue:** Two assertions were removed that guarded the SKILL.md wording contract:

```js
assert.ok(
  content.includes("including confirmations after applying user-requested changes"),
  "flow-plan SKILL.md should enforce Choice Format for confirmation questions",
);
assert.ok(
  content.includes("No free-form questions. No exceptions."),
  "flow-plan SKILL.md should explicitly disallow free-form questions without exceptions",
);
```

These are deleted alongside the SKILL.md revert (proposal #1), but removing regression guards without replacement reduces test coverage for a previously addressed issue.

**Suggestion:** Restore both assertions, or—if the exact wording changes—update them to match the restored SKILL.md wording rather than deleting them.

---

**Verdict:** APPROVED
**Reason:** The diff is structurally defective. The overview `{{text}}` block's closing `<!-- {{/text}} -->` was removed while the paragraph content was left in place, leaving the directive unclosed. Immediately after, a duplicate `<!-- {{text({prompt: "List all configuration files..."})}} -->` followed by `<!-- {{/text}} -->` appears before the actual directive. This creates an orphaned opening tag and a double-declaration of the Configuration Files directive. The `docs text` and `docs build` pipeline will misparse the section boundary on the next run, likely corrupting the overview and Configuration Files sections. The structural fix is necessary to maintain pipeline correctness.

### [x] 3. Duplicate `{{text}}` Directive in `docs/configuration.md`
**File:** `docs/configuration.md`

**Issue:** Two identical `{{text}}` directives appear back-to-back for the "Configuration Files" section (lines 16–18), and the overview `{{text}}` block (line 9) is missing its closing `{{/text}}` tag before `## Content`. The pipeline will treat all intermediate content—including section headers and tables—as inside the overview directive, corrupting the next `docs build`.

**Suggestion:** Add the missing `<!-- {{/text}} -->` after the overview paragraph, and remove the duplicate `<!-- {{text({prompt: "List all configuration files..."})}} -->` block. Only one directive should remain, with its own closing tag.

---

**Verdict:** APPROVED
**Reason:** The diff introduces a redundant close+open pair for the Shared Libraries `{{text}}` block — `<!-- {{/text}} -->` immediately followed by another `<!-- {{text({prompt: "List the shared libraries..."})}} -->`. The second directive also lacks its own closing `<!-- {{/text}} -->` tag at the end of the table content. An unclosed directive is a hard structural defect: the `sdd-forge` pipeline will not be able to correctly identify the section boundary and will corrupt adjacent sections on the next `docs build`. This is not cosmetic — it breaks the auto-generation pipeline.

### [x] 4. Duplicate `{{text}}` Directive in `docs/project_structure.md`
**File:** `docs/project_structure.md`

**Issue:** The Shared Libraries section contains two consecutive identical `{{text}}` directives (lines 39–41), with the first one immediately closed and the second one lacking a closing `{{/text}}`. This leaves the section boundary open and will cause unpredictable behavior during the next `docs text` or `docs build` run.

**Suggestion:** Remove the first (immediately-closed) `{{text}}` block. Keep only the second directive, which contains the actual table content, and ensure it ends with `<!-- {{/text}} -->`.

---

**Verdict:** APPROVED
**Reason:** The diff places `{{data("base.docs.nav")}}` inside the middle of the Operations Flow section (after the dependency management paragraph but before the deployment procedure `{{text}}` directive). Every other docs chapter file positions the nav block at the very end of the document after all content sections. Having it mid-file disrupts the reading experience and, more critically, disrupts the auto-generation pipeline's section ordering — the nav block will be regenerated between the dependency paragraph and the deployment section rather than at the document footer. Moving it to the file's end aligns it with the established pattern and prevents pipeline breakage.

### [ ] 5. Navigation Block Misplaced Mid-File in `docs/stack_and_ops.md`
**File:** `docs/stack_and_ops.md`

**Issue:** The `{{data("base.docs.nav")}}` navigation block appears at line 40, embedded in the middle of the file within the Operations Flow section—not at the end of the document. This creates a broken reading experience and disrupts the auto-generation pipeline's section ordering.

**Suggestion:** Move the `{{data("base.docs.nav")}}` block to the very end of the file, after all content sections, consistent with the placement in all other docs chapter files.

**Verdict:** REJECTED
**Reason:** No verdict provided
