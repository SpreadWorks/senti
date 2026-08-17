# Code Review Results

### [ ] Now I have enough context for a thorough review. Here are the proposals:
---

**Verdict:** REJECTED
**Reason:** The proposed change — shortening `"No free-form questions. No exceptions."` to `"No free-form questions"` — is cosmetic. The test remains structurally coupled to prose content in a file scoped to include-resolution mechanics. Trimming a sentence fragment doesn't fix the underlying architectural mismatch (content-semantics assertions in an include-resolution test). A genuine fix would either move these assertions to a dedicated content-integrity test or snapshot the rendered output against a fixture. The marginal reduction in brittleness does not justify the change on its own.

### [x] 1. Brittle exact-phrase assertions in skill include test
**File:** `tests/unit/lib/skills-include.test.js`

**Issue:** The two new `content.includes(...)` assertions check for verbatim phrases lifted directly from the SKILL.md source. This tightly couples the test to exact wording — any editorial rewrite (e.g. rewording for clarity while preserving the same enforcement intent) will break the test without any behavioral regression. The test file is named `skills-include.test.js`, scoped to *include-resolution* correctness, yet these assertions are checking *prose content semantics*.

**Suggestion:** If the goal is to verify that the "no free-form" constraint is present after include expansion, assert on the key semantic token(s) rather than an entire sentence. Example:

```js
// Instead of full sentence match:
assert.ok(
  content.includes("No free-form questions. No exceptions."),
  "...",
);

// Assert the structural marker that can't be accidentally dropped:
assert.ok(
  content.includes("No free-form questions"),
  "flow-plan SKILL.md should explicitly disallow free-form questions",
);
```

Alternatively, extract the canonical phrases as named constants shared between SKILL.md (or a checked-in fixture snapshot) and the test, so renaming one location requires consciously updating the other.

---

**Verdict:** APPROVED
**Reason:** The diff genuinely breaks the document structure: removing the `<!-- {{/text}} -->` immediately after the overview paragraph leaves that directive unclosed, causing the auto-generation pipeline to treat all subsequent content (directory tree, responsibilities table) as inside the overview `{{text}}` block. The redundant close+open pair at the Shared Libraries section is a secondary symptom of the same mistake. Restoring the closing tag after the overview paragraph and removing the duplicate close before the Shared Libraries directive are necessary structural corrections, not cosmetic changes. This directly prevents unpredictable pipeline behavior.

### [x] 2. Malformed `{{text}}` directive structure — orphaned close + immediate re-open
**File:** `docs/project_structure.md`

**Issue:** The diff removes the `<!-- {{/text}} -->` closing tag from the overview text block (first `{{text}}` directive), then at the Shared Libraries section places `<!-- {{/text}} -->` followed immediately by `<!-- {{text({prompt: "List the shared libraries..."})}} -->`. This results in:
- The overview `{{text}}` directive being left **unclosed** through all the intermediate content (directory tree, responsibilities table).
- A redundant close+open pair where only one directive is needed.

**Suggestion:** Restore the `<!-- {{/text}} -->` directly after the overview paragraph (as it was before), and remove the extra `<!-- {{/text}} -->` that now precedes the Shared Libraries `{{text}}` opening:

```markdown
<!-- {{text({prompt: "Write a 1-2 sentence overview..."})}} -->
This chapter describes the source layout of the project...
<!-- {{/text}} -->

## Content
...

<!-- {{text({prompt: "List the shared libraries..."})}} -->
| Module | File | Responsibility |
...
<!-- {{/text}} -->
```

---

**Verdict:** APPROVED
**Reason:** The diff closes the old Shared Libraries `{{text}}` block, opens a new one, and then places table content — but never adds the closing `<!-- {{/text}} -->`. An unclosed directive is a hard structural defect: the `sdd-forge` pipeline will misparse the section boundary and may corrupt surrounding content on the next `docs build`. Adding the missing closing tag is a necessary correctness fix. (Separately, the removal of the `{{data("base.docs.nav")}}` navigation block from the diff should be verified as intentional before merging, but that is outside the scope of this proposal as stated.)

### [ ] 3. Incomplete Shared Libraries table — partial content outside directive
**File:** `docs/project_structure.md`

**Issue:** The new Shared Libraries `{{text}}` directive opens but there is no corresponding `<!-- {{/text}} -->` closing tag added for it. Only a single row (`presets`) appears in the table. This leaves the section structurally incomplete and will cause the auto-generation pipeline to behave unpredictably when it encounters the unclosed directive.

**Suggestion:** Add the missing `<!-- {{/text}} -->` after the table content:

```markdown
<!-- {{text({prompt: "List the shared libraries..."})}} -->

| Module | File | Responsibility |
| --- | --- | --- |
| presets | `src/lib/presets.js` | ... |
<!-- {{/text}} -->
```

**Verdict:** REJECTED
**Reason:** No verdict provided
