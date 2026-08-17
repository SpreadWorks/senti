# Feature Specification: 132-gate-draft-impl

**Feature Branch**: `feature/132-gate-draft-impl`
**Created**: 2026-04-03
**Status**: Draft
**Input**: Issue #75

## Goal

draft フェーズと impl フェーズに gate チェックを導入し、guardrail が実際に効いているかを PASS/FAIL で可視化する。
あわせて、既存 spec gate のエラーハンドリングを throw から構造化結果に統一する。

## Scope

1. `sdd-forge flow run gate` コマンドに `--phase draft` / `--phase impl` を追加
2. gate draft: draft.md のテキスト構造チェック + guardrail AI チェック
3. gate impl: spec.md Requirements + git diff の AI チェック + guardrail AI チェック
4. 既存 spec gate の FAIL 時を throw から `{ result: "fail" }` return に変更（全 gate 統一）
5. flow-state.js に `gate-draft`, `gate-impl` step ID を追加
6. registry.js の post hook を FAIL 時も動作するよう更新
7. SKILL.md（flow-plan, flow-impl）に gate ステップを挿入
8. テストの追加・更新

## Out of Scope

- 静的チェックへの移行（将来の段階的移行は issue #75 の後続作業）
- guardrail 記事の追加・変更（既存の `meta.phase` タグをそのまま使用）
- gate のリトライロジック変更（リトライ制御は引き続き SKILL.md が担当）
- テスト phase の gate

## Clarifications (Q&A)

- Q: `pre`/`post` は廃止するか？
  - A: 廃止しない。ログ保存等で使用中。`--phase` に `draft`/`impl` を値として追加する
- Q: gate draft のテキスト構造チェック対象は？
  - A: Q&A の有無、ユーザー承認、開発種別、目的（ゴール）
- Q: gate impl のチェック方式は？
  - A: AI チェックのみ。spec.md Requirements + `git diff baseBranch...HEAD` を AI に渡す
- Q: gate FAIL 時のエラーハンドリングは？
  - A: throw をやめて `{ result: "fail", next: "<phase>" }` を return。復旧不能エラーは throw 維持
- Q: step ID は共用か別々か？
  - A: `gate-draft`, `gate`（spec 用、既存）, `gate-impl` の3つを別々に管理

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-03
- Notes: gate PASS 後に承認

## Requirements

**優先順位**: R5 (エラーハンドリング統一) > R1 (phase 拡張) > R6 (step ID) > R7 (registry) > R2 (gate draft テキスト) > R3 (gate draft AI) > R4 (gate impl) > R8 (SKILL.md) > R9 (テスト)

理由: R5 は既存 spec gate の動作を変える基盤変更。R1/R6/R7 はその上に乗るインフラ。R2-R4 が新機能の実体。R8/R9 は実装後の反映。

### R1: `--phase` オプションの拡張
- `sdd-forge flow run gate --phase <draft|pre|post|impl>` で呼び出せること
- `--phase` 省略時のデフォルトは `pre`（既存動作維持）
- draft/impl 指定時はそれぞれ専用のチェックロジックを実行すること

### R2: gate draft のテキスト構造チェック (`checkDraftText`)
- draft.md を読み込み、以下の項目の存在を検証すること:
  - Q&A セクション（質疑の記録があること）
  - ユーザー承認チェックボックス（`- [x] User approved this draft`）がチェック済みであること
  - 開発種別（機能追加/バグ修正/新規開発 等の記載）
  - 目的/ゴール（Goal の記載）
- 不足項目があれば `result: "fail"` で返すこと
- gate draft は draft 承認後に呼ばれる前提（SKILL.md のフロー順で保証）。承認前に呼ばれた場合はチェックボックス未チェックとして FAIL を返す

### R3: gate draft の guardrail AI チェック
- `filterByPhase(guardrails, "draft")` で draft フェーズの guardrail を取得
- draft.md の内容を AI に渡し、各 guardrail の観点が「検討されたか」を PASS/FAIL で判定
- 既存の `buildGuardrailPrompt` / `parseGuardrailResponse` パターンを踏襲

### R4: gate impl の AI チェック
- spec.md の Requirements セクションを読み込む
- `git diff <baseBranch>...HEAD` で feature ブランチ全体の差分を取得
- Requirements + diff を AI に渡し、各要件の実装有無を PASS/FAIL で判定
- `filterByPhase(guardrails, "impl")` の guardrail 準拠も同時にチェック

### R5: エラーハンドリング統一（全 gate）
- gate チェック FAIL 時は throw ではなく以下を return すること:
  ```
  { result: "fail", changed: [], artifacts: { phase, reasons, issues }, next: "<retry-target>" }
  ```
- `next` は phase に応じた値: draft → `"draft"`, pre/post → `"spec"`, impl → `"implement"`
- 復旧不能エラー（ファイル未発見、設定不備）は従来通り throw（`ok: false`、非ゼロ終了コード）
- gate チェック FAIL は「コマンドは正常に実行されたが、チェック結果が不合格」を意味する。エラーの黙殺ではなく、FAIL の理由は `artifacts.reasons` / `artifacts.issues` に全て記録され出力される
- SKILL.md（AI）は `data.result` フィールドを見て PASS/FAIL を判定し、リトライを制御する

### R6: step ID の追加
- `FLOW_STEPS` に `gate-draft`（`draft` の後、`spec` の前）と `gate-impl`（`implement` の後、`review` の前）を追加
- `PHASE_MAP` に `"gate-draft": "plan"`, `"gate-impl": "impl"` を追加
- 既存の `gate` step ID はそのまま維持（spec gate 用）

### R7: registry の更新
- `--phase` の値域に `draft`, `impl` を追加
- pre hook: gate コマンド実行開始時に、`--phase` の値に応じた step ID を `in_progress` に設定すること
  - `--phase draft` → `gate-draft` を `in_progress`
  - `--phase pre` または `--phase post` または省略 → `gate` を `in_progress`
  - `--phase impl` → `gate-impl` を `in_progress`
- post hook: gate コマンドが正常に return した場合（throw しなかった場合）に、`--phase` の値に応じた step ID を return 値の `result` フィールドに基づいて更新すること
  - `return.result === "pass"` の場合 → step を `done` に設定
  - `return.result === "fail"` の場合 → step を `in_progress` のまま維持（SKILL.md がリトライ判断する）
  - throw の場合 → post hook は実行されない（既存動作通り）

### R8: SKILL.md の更新
- `flow-plan/SKILL.md`: draft 完了後（step 4 の後）に gate draft ステップを追加。リトライ上限 10 回
- `flow-impl/SKILL.md`: implement 完了後（review 前）に gate impl ステップを追加。リトライ上限 5 回
- gate の `result` フィールドを見て PASS/FAIL を判定する記述に更新

### R9: 既存テストの更新 + 新テスト追加
- `checkSpecText` のテスト: throw ではなく return に変更された `RunGateCommand.execute` のテスト更新
- `checkDraftText` のユニットテスト追加
- gate impl の AI チェックロジックのテスト追加
- CLI 統合テスト: `--phase draft` / `--phase impl` の動作確認

## Acceptance Criteria

- [ ] `sdd-forge flow run gate --phase draft` で draft.md のテキスト構造チェック + guardrail AI チェックが実行される
- [ ] `sdd-forge flow run gate --phase impl` で spec Requirements + git diff の AI チェックが実行される
- [ ] gate FAIL 時に `{ ok: true, data: { result: "fail", ... } }` が返る（throw しない）
- [ ] gate PASS 時の既存動作（`{ ok: true, data: { result: "pass", ... } }`）が維持される
- [ ] `--phase` 省略時は既存の spec gate（`pre`）が動作する
- [ ] flow.json の `steps` に `gate-draft`, `gate-impl` が含まれる
- [ ] registry の pre/post hook が phase に応じた step ID を更新する
- [ ] flow-plan SKILL.md に gate draft ステップ（リトライ上限 10 回）が記載されている
- [ ] flow-impl SKILL.md に gate impl ステップ（リトライ上限 5 回）が記載されている
- [ ] 既存の `npm test` が通る
- [ ] 新規テスト（checkDraftText, gate impl ロジック）が通る

## Open Questions

- [x] 全て解決済み
