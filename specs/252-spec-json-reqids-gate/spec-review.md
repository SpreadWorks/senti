# Spec Review Results

## Proposals

### 1. 依頼内容は「spec の抜け漏れレビュー」なので、まず `run-gate` と `spec-json` 周辺の実装・既存テストを確認し、spec の Scope/Out/Requirements に未記載の依存箇所や矛盾がないかを洗い出します。続けて、削除・移動時に壊れる外部参照（テスト/テンプレート/設定）も確認します。作業ディレクトリ直下にソースがなく、`.tmp` 配下だけが見えている状態です。worktree 境界内でリポジトリ本体を探すため、1つ上の階層を確認します。`run-gate` の要件ID選択ロジックを確認しました。次に既存テストと補助モジュールを見て、spec が見落としている依存ファイル（単体テストや補助関数）を特定します。関連検索から、`tests/e2e/flow/gate-impl-integration.test.js` 以外にも `tests/unit/specs/commands/gate.test.js` が `run-gate` の実装詳細を直接検証していることが分かりました。次はこの単体テスト側の依存を確認して、spec のテストスコープ漏れを判定します。`file-map` 経由の副作用（ID不一致時の挙動）が spec に十分書かれているかを確認するため、`req-map` と gate 関連テストで `file-map` あり/なし・ID不一致ケースの扱いを追います。ここまでで、`REQ-SPEC` 依存や `spec.md` マーカー前提の記述が他ファイルに残っていないかを追加で確認します。spec がそこを Out of Scope にしていると、変更後にテスト・ドキュメントが齟齬を起こす可能性があります。### 1. Define `usable requirement ID` normalization precisely
**File:** `src/lib/spec-json.js`  
**Issue:** The spec says “non-empty string” but does not define handling of whitespace-only IDs or duplicate IDs. `spec.schema.json` allows both, and ambiguity here can cause unstable prompt IDs or duplicate per-requirement loops.  
**Suggestion:** Add a requirement that usable IDs are `trim()`ed, whitespace-only values are ignored, and duplicates are de-duplicated in first-seen order before returning IDs.

### 2. 2. Add direct unit coverage for the new shared helper
**File:** `tests/unit/lib/load-spec-json.test.js`  
**Issue:** Scope requires a shared helper in `spec-json.js`, but tests are only specified at e2e gate level. Helper edge cases (missing/empty requirements, malformed entries, whitespace IDs, duplicates) are not explicitly covered.  
**Suggestion:** Add in-scope unit tests for the helper’s enumeration behavior and fallback-trigger conditions, separate from e2e gate tests.

### 3. 3. Clarify integration-phase precheck precedence
**File:** `src/flow/lib/run-gate.js`  
**Issue:** Integration gate has artifact prechecks (`test-result-review.json` / `test-execute-result.json`) that can short-circuit before requirement-ID selection. The spec mentions integration impact but does not state this ordering, which can create contradictory expectations.  
**Suggestion:** Explicitly document that the new source-selection rule applies to integration only after existing integration prechecks pass.

### 4. 4. Resolve ambiguity for malformed `file-map.json`
**File:** `src/flow/lib/req-map.js`  
**Issue:** The spec says ID enumeration should be independent of `file-map.json` presence, but does not specify behavior when `file-map.json` exists but is malformed/unreadable. Current behavior can fail before selection logic.  
**Suggestion:** Add an explicit statement: malformed/unreadable `file-map.json` behavior is unchanged (out of scope), or define desired recovery behavior (e.g., ignore map and continue with full diff).

### 5. 5. Protect shared stub defaults from collateral test breakage
**File:** `tests/helpers/stub-agent.js`  
**Issue:** R9 asks for explicit per-case stub IDs, but the spec does not guard against changing shared `defaultPassResponse()` (`REQ-SPEC`), which is reused across suites and can cause unrelated regressions.  
**Suggestion:** Add a requirement that source-selection tests must use per-test stub payloads (local fixtures) and must not change shared default stub behavior globally.
