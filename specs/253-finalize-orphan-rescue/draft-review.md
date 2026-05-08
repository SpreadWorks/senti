# Draft Review Results

12 issue(s) detected.

### 1. I’ll review this as QA-spec quality, not implementation. I’m going to spot-check the referenced flow/merge/envelope files so the proposals are grounded in the actual code shape.The `.tmp` cwd does not contain `src/` directly, so I’m checking the worktree layout before drawing conclusions from file paths.I found one internal contradiction already: the route/null strategy behavior differs between Q6, Q9, and Q12. I’m checking the post-hook/state persistence path because several QA answers assume new merge metadata can be saved but do not pin where that happens.### 1. Contradictory `mergeStrategy=null` Contract
**QA:** Q6, Q9, Q12  
**Issue:** Q6 says `mergeStrategy=null` must fail-safe halt, but Q9 expects “検出スキップ + STRATEGY_UNKNOWN warning”, and Q12 defines `STRATEGY_UNKNOWN` as `ok:true` with branch/worktree deleted. This is a spec-breaking contradiction.  
**Suggestion:** Pick one contract. Given the issue goal is preventing silent loss, align Q9/Q12 with Q6: unknown strategy should fail/halt unless `--force` is explicitly supplied.

### 2. 2. Missing State Persistence Spec
**QA:** NEW  
**Issue:** Multiple entries depend on `state.mergeStrategy` and `state.featureBranchSquashedSha`, but no QA entry specifies exactly where these fields are written to `flow.json`, how the registry post hook persists them, or how retry/PR/skip paths reset them.  
**Suggestion:** Add a QA entry for the flow-state schema: field names, allowed values, writer location, post-hook mutation order, retry behavior, and expected values for squash/PR/spec-only/failure.

### 3. 3. Guard Ordering Is Internally Ambiguous
**QA:** Q4, Q6  
**Issue:** Q4 says the orphan guard runs at the absolute start of cleanup, before step status updates. Q6 says route discriminator must run before baseline checks so PR/spec-only can skip detection. These imply different first operations.  
**Suggestion:** Define exact cleanup order: args validation → spec-only/PR/unknown strategy routing → orphan guard for squash only → step update/commit/teardown.

### 4. 4. SHA Capture Path Is Underspecified
**QA:** Q3  
**Issue:** Q3 focuses on worktree squash and detached fallback, but does not clearly cover branch mode. It also says `mergeResult.mergedFromSha` is returned without specifying changes to `runSquashMerge`, `runMerge`, `run-finalize-merge`, and the registry post hook needed to carry and persist that value.  
**Suggestion:** Expand Q3 to specify all squash routes: worktree/main checkout, detached fallback, and branch mode. Include the exact return payload and persistence path into `flow.json`.

### 5. 5. Orphan Definition Overclaims “Not Included In Base”
**QA:** Q2, Q11  
**Issue:** The proposed definition detects commits topologically after `recordedSha`, but Q11 tells users those commits are “NOT included in baseBranch”. That claim is not always supported: a post-squash fix could already have been cherry-picked to base with different topology.  
**Suggestion:** Either add a patch-equivalence check for `recordedSha..featureBranch`, or soften the message to “not reachable from the recorded squash baseline and would be dropped by branch deletion.”

### 6. 6. Issue-Log Dirty State Conflicts With Auto-Rescue
**QA:** Q7, Q10  
**Issue:** Q10 says `CHERRY_PICK_CONFLICT` writes `issue-log.json` to the main repo and leaves cleanup halted. Q7 says auto-rescue refuses to run when the main repo is dirty. A retry after conflict may therefore fail because of the issue-log file created by the previous failure.  
**Suggestion:** Define whether conflict issue-log writes are committed immediately, excluded from the dirty check, staged intentionally, or delayed until a successful cleanup retry.

### 7. 7. Issue-Log Rollback Is Too Vague
**QA:** Q10  
**Issue:** “最終 entry pop” rollback is fragile and unsupported. If another issue-log entry exists or the write partially changes formatting, popping the final entry may remove the wrong record.  
**Suggestion:** Require a stable entry id/timestamp captured before write, or reload the pre-write file content and restore that exact content on commit failure.

### 8. 8. Test Plan Contradicts Main Spec
**QA:** Q9  
**Issue:** Test case 9 expects `mergeStrategy=null` to skip detection and delete with warning, contradicting Q6’s fail-safe halt.  
**Suggestion:** Replace that test with: `mergeStrategy=null` fails with unknown/baseline-missing style code, preserves branch/worktree, and only `--force` permits deletion.

### 9. 9. Missing Tests For CLI Help And Skill Prompt
**QA:** Q5, Q9, Q11  
**Issue:** Q5 and Q11 introduce new CLI flags, help text, and AI prompt behavior, but Q9 only tests command behavior. It does not cover parser registration/help output or `finalize-cleanup.md` response requirements.  
**Suggestion:** Add tests for `--auto-rescue`/`--force` recognition, help text, mutual exclusion, and prompt/skill instructions for the three recovery choices.

### 10. 10. Stderr Duplication Is Unsupported
**QA:** Q11  
**Issue:** Q11 requires the same recovery guidance in both envelope messages and stderr. Existing flow commands primarily communicate structured failures via envelopes; duplicating stderr may break machine-readable command expectations or snapshot tests.  
**Suggestion:** Specify one canonical channel. Prefer envelope `errors[].messages` plus structured `data.recoveryOptions`; only use stderr if the dispatcher convention explicitly requires it.

### 11. 11. Manual Recovery Guidance Is Still Risky
**QA:** Q8  
**Issue:** Q8 says duplicate cherry-picks are safe because Git fails with “nothing to commit”, but that can leave the user in a cherry-pick state requiring `--skip` or `--abort`. The recovery instructions do not mention this.  
**Suggestion:** Add explicit handling for empty cherry-pick results: inspect status, run `git cherry-pick --skip` or `git cherry-pick --abort`, then continue only after the repo is clean.

### 12. 12. `--force` Audit Contract Needs Sharper Scope
**QA:** Q10, Q12  
**Issue:** Q12 says some fail paths have optional issue-log, while Q10 makes forced drops mandatory. “optional” is too vague for audit behavior around destructive cleanup.  
**Suggestion:** Make issue-log requirements explicit per code: mandatory for `FORCED_ORPHAN_DROP`, mandatory or not for `CHERRY_PICK_CONFLICT`, and never for pure validation errors like `ARGS_ERROR`.
