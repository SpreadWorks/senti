# Draft Review Results

4 issue(s) detected.

### 1. I’ll check the relevant flow definition and consumers enough to judge whether the QA draft has unsupported claims or missed scope, then I’ll return only the proposal list format you requested.The provided cwd is the `.tmp` directory and it does not contain the repo files directly. I’m locating the worktree root within the allowed workspace before checking the source.### 1. Q5 overclaims old-order cleanup
**QA:** Q5  
**Issue:** The answer says old `implement → gate-impl → review` ordering remains only in order-insensitive `.includes()` lists, but tests also contain ordered-looking fixtures/comments such as `setStepDone(..., "implement", "gate-impl", "review")` and `doneStepIds` arrays. Even if behavior is order-insensitive, the claim is inaccurate.  
**Suggestion:** Broaden Q5 to cover all old-order text hits in tests, classify each as order-sensitive or cosmetic, and require updating comments/fixtures to `implement → review → gate-impl` where they communicate sequence.

### 2. 2. Template QA misses another sequence mismatch on the same line
**QA:** Q6  
**Issue:** Q6 updates the frontmatter implementation phrase, but the same description line also says finalization is `commit → merge → cleanup → docs sync`, while `FLOW_DEFINITION` orders finalize as `commit → merge → sync → cleanup`. Since the spec already touches that line, leaving another wrong sequence there weakens user-facing consistency.  
**Suggestion:** Amend Q6 to update the whole frontmatter sequence to match `FLOW_DEFINITION`, including `finalization (commit → merge → docs sync → cleanup)` or the project’s preferred wording.

### 3. 3. Upgrade target is too narrow
**QA:** Q6  
**Issue:** The answer says run `sdd-forge upgrade` to reflect changes into `.claude/skills/sdd-forge.flow/SKILL.md`, but project rules mention both `.claude/skills/` and `.agents/skills/`. This underspecifies verification of generated skill outputs.  
**Suggestion:** Change the answer to require running `sdd-forge upgrade` and verifying every generated skill target reported by the command, including `.agents/skills/` when present.

### 4. 4. Missing explicit check that review-produced code changes are gated afterward
**QA:** NEW  
**Issue:** The issue’s purpose is avoiding code changes after gate PASS. Existing entries discuss side effects and ordering, but none directly verifies that impl review’s apply/correction path completes before `gate-impl` runs and that gate evaluates the post-review diff.  
**Suggestion:** Add a QA entry asking: “Does impl review’s proposal/apply path finish before `gate-impl`, and does the subsequent gate evaluate the resulting changed code?” The answer should cite `run-review.js`/`registry.js` post-hook behavior and require the runtime next-action test to cover `implement done → review → gate-impl`.
