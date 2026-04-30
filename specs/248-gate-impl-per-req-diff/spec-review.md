# Spec Review Results

## Proposals

### 1. 仕様の見落とし確認なのでコード変更はしません。まず `docs/` と `src/` の更新時刻を確認しつつ、gate 実装と file-map 参照箇所、テンプレート・テスト側の依存を洗います。指定の worktree 直下に通常の `src/` が見えていないようです。現在位置の構造を確認して、実際のリポジトリ内容がどこにあるかを特定します。Git の top-level は `.tmp` の親ディレクトリで、worktree 境界内です。以降はその top-level を基準に読み取り、見落とし候補をコードから確認します。`src/` の方が最新ファイル一覧の上位に出ており、作業前チェックとしては docs が古い可能性があります。レビュー自体はソースを正として続け、仕様への指摘に必要な箇所を絞って読みます。現在の実装では requirement チェックと guardrail チェックが同じ `executeDiffBasedGate` 内にあります。次に、既存テストと issue-log/retry 周りのデータ形状を確認して、仕様が集約・再試行・警告のどこまで定義すべきかを見ます。見落とし候補は主に `run-gate.js` の既存責務に集中しています。特に、現行の requirement ID 抽出、retry/issue-log の PASS 履歴、file-map reconciliation が仕様の差分分割とずれる可能性があります。### 1. Requirement Source Of Truth
**File:** `src/lib/spec-json.js`  
**Issue:** The spec says `spec.md` / requirement IDs are used, but the codebase has moved requirement source of truth to `spec.json.requirements`. `file-map.json` is also validated against `spec.json` IDs, while current `run-gate.js` still extracts IDs from `spec.md` via `**REQ-*` markers.  
**Suggestion:** Specify that gate-impl loads requirements through `loadSpecJson` / `normalizeRequirements`, and that per-requirement prompts use the single requirement’s `id`, `priority`, and `desc` from `spec.json`, not regex extraction from `spec.md`.

### 2. 2. Impl Diff Collection Shape
**File:** `src/flow/lib/run-gate.js`  
**Issue:** The spec requires “per-file diff collection” but does not define how to preserve gate-impl’s current committed + uncommitted + untracked semantics when producing per-file diffs. Current helpers return one concatenated diff string, and `collectUntrackedDiff()` also returns concatenated text.  
**Suggestion:** Add a requirement for a gate-impl-specific helper such as `collectImplDiffsByFile(root, baseBranch)` that returns a file-keyed structure covering committed diff, `HEAD` diff, and synthesized untracked diffs.

### 3. 3. File-Map Reconciliation Universe
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Existing `reconcileFileMapWarnings()` checks only `git diff --name-only <base>...HEAD`, but gate-impl evaluates committed + uncommitted + untracked diffs. The spec’s unmapped-file behavior would be inconsistent with the warning path.  
**Suggestion:** Specify that file-map reconciliation must use the same file universe as the per-requirement diff splitter, including uncommitted and untracked files.

### 4. 4. PASS History Semantics
**File:** `src/flow/lib/run-gate.js`  
**Issue:** REQ-6 says previously PASSed requirements should not be re-evaluated, but the existing `previouslyPassedIds` mechanism is guardrail-oriented and `executeDiffBasedGate()` currently bypasses that prompt injection for requirement checks. It also stores passed requirement IDs and guardrail IDs together via `passedGuardrails`.  
**Suggestion:** Define whether requirement PASS history is stored separately, or explicitly allow requirement IDs in `passedGuardrails`; then require the per-requirement loop to skip those IDs before AI calls while preserving existing guardrail PASS behavior.

### 5. 5. Guardrail Full-Diff Cost Gap
**File:** `src/flow/lib/run-gate.js`  
**Issue:** The goal is to reduce gate-impl token usage, but guardrail checks remain full spec + full diff. Guardrail splitting is Out of Scope, but the spec does not clarify that a large full-diff AI call will still happen after requirement checks.  
**Suggestion:** Add an explicit note that this change only reduces requirement-check token usage, and guardrail evaluation continues to receive the full diff; or add acceptance criteria that token savings are measured only for the requirement-check call path.

### 6. 6. Missing Test Coverage Targets
**File:** `tests/e2e/flow/gate-impl-integration.test.js`  
**Issue:** Existing gate-impl tests exercise fallback-style behavior and even note that `spec.md` lacks requirement markers, causing `REQ-SPEC` fallback. The spec does not require tests for file-map-based per-requirement routing.  
**Suggestion:** Add test requirements for: missing/empty `file-map.json` fallback, mapped requirement receiving only mapped + unmapped diffs, unregistered requirement receiving all diff, mapped requirement with empty relevant diff being skipped, untracked-file routing, and retry skipping of previously PASSed requirements.
