# Spec Review Results

## Proposals

### 1. 仕様レビューとして、まず関連モジュールとテンプレート側の実体を確認します。コード変更はせず、見落とし候補だけを抽出します。現在の作業ディレクトリには期待した `src/` が見えていない可能性があります。worktree 境界を越えない範囲で、ディレクトリ構成を確認します。Git の top-level は `.tmp` の親です。読み取りだけなので、同じ worktree 内の親ディレクトリから関連ファイルを確認します。関連箇所は広いですが、cleanup/merge/registry/flow-store/skill template と既存テストの接点に絞って読みます。特に「CLI 登録」と「skill 配布/upgrade」の依存関係を確認します。テンプレートの include だけでなく、実際に配布される skill/rules と既存テストの固定文言が依存点になりそうです。次に upgrade と skill 生成周りを確認します。実装上、`finalize-cleanup` の前段には `finalize-sync` と `get next-action` の prompt 注入があります。orphan halt 後の再開導線に関わるため、そこも仕様が触れているかを見ています。### 1. Cleanup Post-Hook Can Re-Dirty Final `flow.json`
**File:** `src/flow/registry.js`  
**Issue:** `finalize-cleanup` post hook calls `updateStepStatus(..., "done")` after the cleanup body has already committed the final `flow.json`. Since `updateStepStatus` refreshes `finishedAt`, this can leave `flow.json` dirty after cleanup. The spec says success paths preserve the finalize report, but does not require preventing post-hook mutation after the cleanup transaction.  
**Suggestion:** Add a requirement that `finalize-cleanup` success must leave the main repo clean, and that the post hook must be no-op/idempotent without rewriting timestamps when the cleanup body already committed the terminal state.

### 2. 2. Audit Log Durability Is Not Tied To Cleanup Commit
**File:** `src/flow/lib/run-finalize-cleanup.js`  
**Issue:** The current cleanup transaction stages only `specs/<id>/flow.json`. R14 requires audit logs to survive teardown, but the spec does not state that `issue-log.json` written by `--force` or interrupted `--auto-rescue` must be staged/committed before branch deletion.  
**Suggestion:** Specify that destructive-path audit entries are written to the main repo and included in the final cleanup commit, or otherwise persisted before worktree/branch removal.

### 3. 3. Existing `onError` Hook Conflicts With “No Audit For Detection Errors”
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** `finalizeOnError()` appends issue-log entries for thrown finalize errors. R15 says validation/detection errors such as baseline missing, baseline diverged, and orphan halt must not be logged, but the spec does not say these paths must return `Envelope.fail` instead of throwing, nor does it update the hook contract.  
**Suggestion:** Add a requirement that expected orphan/baseline halt paths return canonical `Envelope.fail` values and bypass `finalizeOnError`, or explicitly filter those error codes in the finalize-cleanup `onError` path.

### 4. 4. Dirty-Check Exclusion Depends On Finalize Preflight Code
**File:** `src/flow/lib/run-finalize.js`  
**Issue:** R14 says retry after auto-rescue interruption must not be blocked by the audit log’s existence, but the relevant dirty-worktree logic lives in `runPreflightChecks()` / `listUncommittedFiles()`, not `set-issue-log.js`. The spec does not name this module.  
**Suggestion:** Add `src/flow/lib/run-finalize.js` to Scope and require pathspec exclusion for `specs/<id>/issue-log.json` only in the intended retry/audit-log case.

### 5. 5. Persistent Skill Rules Still Allow Auto-Selection Semantics
**File:** `src/templates/skills/rules.json`  
**Issue:** `get-next-action` prepends persistent rules from `rules.json`. The spec updates `core-principle.md` and `sdd-forge.flow/SKILL.md`, but not the rule set that applies to `flow.finalize-cleanup`. Existing rules still contain broad auto-mode/actuation language and `choice-format-discipline` does not cover `flow.finalize-cleanup`.  
**Suggestion:** Require a `rules.json` update so orphan/baseline recovery choices are explicit autoApprove exceptions and finalize-cleanup recovery prompts are covered by Choice Format.

### 6. 6. Finalize Output Schema Does Not Model Recovery Outcomes
**File:** `src/flow/schemas/next-action/finalize.schema.json`  
**Issue:** The schema only allows `finalized`, `commit_sha`, and `pr_url`. The spec requires the AI skill prompt to react to orphan recovery choices and cleanup halt envelopes, but does not say whether the finalize next-action schema should represent “halted with recovery choices” or remain intentionally command-envelope-only.  
**Suggestion:** Either extend the schema with recovery/halt fields used by the AI response, or state explicitly that orphan recovery is driven solely by the `flow run finalize-cleanup` envelope and not by next-action output schema.

### 7. 7. Flow-State Schema Requirements Contradict Baseline-Missing Halt
**File:** `src/lib/flow-store.js`  
**Issue:** R5 requires missing squash baseline to load and halt as `SQUASH_BASELINE_MISSING`, while R16 says value-range/schema validation rejects inconsistent route/baseline combinations and old schema migration is out of scope. If the new fields are mandatory at load time, old or partially written `flow.json` may fail before cleanup can emit the required envelope.  
**Suggestion:** Define the exact nullable states allowed by schema validation, e.g. route absent/null is loadable but cleanup maps squash-with-missing-baseline to `SQUASH_BASELINE_MISSING`; reserve schema rejection for impossible combinations.

### 8. 8. Auto-Rescue Reuses A Private Detached-Worktree Pattern
**File:** `src/flow/commands/merge.js`  
**Issue:** R9 says `--auto-rescue` should use the same detached worktree fallback as merge, but that fallback is currently embedded inside `runMerge()` as local logic. The spec does not mention extracting or sharing it, which invites duplicated branch-lock/update-ref behavior.  
**Suggestion:** Add a design requirement to extract the detached worktree fallback/update-ref sequence into a reusable helper, with merge and cleanup auto-rescue both covered by the same tests.
