# Spec Review Results

## Proposals

### 1. Spec completeness reviewとして、まず対象の実装と既存テスト・参照箇所を確認します。コード変更はせず、spec が見落としている依存や矛盾だけを洗います。この worktree の `.tmp` 配下は通常のリポジトリ直下ではない可能性があるので、まず配置を確認します。AGENTS の境界に従い、指定 worktree パス内だけを見ます。`git rev-parse` 上は実体の worktree root が `.tmp` の親ディレクトリです。レビューに必要なソースはその中にあるため、読み取り専用で root 側の参照箇所を確認します。主要な参照は `run-gate.js`、単体テスト、過去 spec の executable test に集中しています。次に export/import と error data の消費側を絞って確認します。### 1. Define nullish normalization behavior
**File:** `src/flow/lib/run-gate.js`  
**Issue:** R1 says `String(text).toLowerCase()`, which makes `normalize(null)` tokenize `"null"` and `normalize(undefined)` tokenize `"undefined"`. That conflicts with the empty-reason / empty-set intent and the current helper’s nullish behavior.  
**Suggestion:** Add an explicit requirement: `normalize(null)` and `normalize(undefined)` return an empty `Set`, or state that `normalize` only accepts already-stringified input and remove nullish tests.

### 2. 2. Resolve fixture contradiction
**File:** `tests/unit/flow/gate-repeat-escalate.test.js`  
**Issue:** Scope/R10 say issue #313’s 11 cases are reference-only and must not become automated fixtures, but Design Principles/Overview say to adopt the 11 cases and regress A/B grouping.  
**Suggestion:** Pick one policy. Given R10’s rationale, change Overview/Design Principles to “synthetic fixtures only; issue cases remain rationale/evidence.”

### 3. 3. Add dispatcher envelope verification
**File:** `src/lib/dispatcher.js`  
**Issue:** The spec changes `err.data.matched[]`, but the user-visible CLI envelope depends on dispatcher copying thrown `err.data` into `env.data`. Scope does not mention this propagation path or a regression test for it.  
**Suggestion:** Add `tests/unit/flow/throw-to-envelope-codes.test.js` or similar coverage for an `ESCALATE_REPEATED_FAIL` throw becoming `ok:false` with the new `{ guardrail_id, currentReason, priorReason, similarity }` shape.

### 4. 4. Cover throw-path issue-log persistence
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Out of Scope says `appendIssueLogFromGateError` should keep writing only `err.message`, but the spec’s required tests focus on `appendIssueLogFromGateResult`. The throw-path persistence behavior is unverified despite the message/data schema changing.  
**Suggestion:** Add a test that an `ESCALATE_REPEATED_FAIL` error logged through `appendIssueLogFromGateError` does not persist `matched` / structured data and does not increment retry counters.

### 5. 5. Mention stale in-file comments explicitly
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Several comments/JSDoc references say “repeated identical”, “most recent”, and exact `(guardrail, reason)` comparison. The spec requires logic changes but does not explicitly require updating these nearby references.  
**Suggestion:** Add a requirement to update the section header, helper JSDoc, call-site comments, and issue-log comments to say Jaccard / similar FAIL / all prior same-phase entries.
