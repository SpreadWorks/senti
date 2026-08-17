# Code Review Results

### [ ] 1. Duplicate Rule Across Files
**File:** `src/templates/partials/core-principle.md` and `src/templates/skills/sdd-forge.flow-finalize/SKILL.md`
**Issue:** The newly added rule is copy-pasted verbatim into both files. Since `core-principle.md` is a partial designed to be the canonical source for core constraints, repeating the same sentence in `SKILL.md` creates a maintenance hazard — future edits must be applied in two places and can easily diverge.
**Suggestion:** Keep the rule only in `core-principle.md`. In `SKILL.md`, replace the duplicate line with a reference such as `- See core-principle constraints above (no chaining, no backgrounding, wait for completion).` — or remove it entirely if `core-principle.md` is already embedded into the rendered skill document.

---

**Verdict:** REJECTED
**Reason:** The proposal's safety depends entirely on whether `core-principle.md` is actually embedded into the rendered `SKILL.md`. That relationship is not confirmed by the diff or the proposal itself. If it is *not* embedded (i.e., the partial is only used in other contexts), removing the rule from `SKILL.md` silently drops a hard safety constraint exactly where it needs to be enforced. The suggested replacement — a vague prose reference like "See core-principle constraints above" — is weaker than the current explicit rule text and would not be machine-actionable for an AI following the skill. Until the embedding pipeline is verified to always include `core-principle.md` in the SKILL.md render, the duplication is preferable to the risk of a silent constraint loss. This is not cosmetic — it is a safety-critical constraint, and conservative duplication is appropriate here.

### [x] 2. Logical Contradiction Between Adjacent Rules
**File:** `src/templates/partials/core-principle.md` (and mirrored in `SKILL.md`)
**Issue:** The paragraph immediately before the new line reads: *"NEVER chain or background `sdd-forge` commands."* The new line then opens with *"If a `sdd-forge` command goes to background…"* — implying a background execution is a valid state to handle. This contradicts the absolute prohibition and sends mixed signals to the AI about whether backgrounding is ever permissible.
**Suggestion:** Merge the two rules into one coherent statement that covers both the prohibition and the recovery behavior:

```
**NEVER chain or background `sdd-forge` commands.** Each command must be run as a
separate, foreground Bash invocation. Do not use `&&`, `||`, `;`, pipes, or
`run_in_background`. If a command nevertheless ends up in the background (e.g., due
to tool behavior), wait for its completion notification before proceeding — do not
treat it as complete or advance to the next step.
```

This eliminates the contradiction by framing the second clause as a defensive fallback rather than an implied alternative mode.

**Verdict:** APPROVED
**Reason:** The contradiction is real and non-trivial. An AI following these rules could reasonably interpret the second sentence as implicitly accepting background execution as a recoverable mode, thereby weakening the absolute prohibition in the first sentence. The proposed merged text eliminates this ambiguity by explicitly framing the recovery behavior as a *defensive fallback* ("nevertheless ends up in the background… due to tool behavior") rather than an implied alternative path. The merged phrasing is strictly more constraining than the two-sentence version — it preserves both the prohibition and the recovery behavior without opening a logical escape hatch. No existing behavior is broken; the change only tightens and clarifies intent.
