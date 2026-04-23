# Feature Specification: 219-finalize-preflight-no-commits

**Feature Branch**: `feature/219-finalize-preflight-no-commits`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #232

## Goal
- `flow run finalize` の preflight が、commit step が処理すべきケース（コミット 0 件 + 未コミット差分あり、および dirty-worktree）まで弾く問題を解消し、commit step が想定通り初コミット作成・dirty 吸収を行えるようにする。

## Background
- spec 211 で finalize に preflight を追加し、(R2) コミットゼロのまま finalize を呼ばれた場合の空 commit 防止 と (R4) dirty worktree 検知 を実装した。
- しかし commit step は `git add -A` + 自動コミットで未コミット差分を取り込む設計のため、preflight が dirty を弾くと commit step の仕事を奪うことになる。
- Issue #232 (5b26) は no-commits + uncommitted の組み合わせで、board item abe0 は ahead>0 + dirty で同様の問題を踏む（両方とも commit step が処理すべきケース）。

## Scope
- finalize の preflight 判定方針を「commit step を含む実行か否か」で分岐させる。
- commit step を含む実行: 真にやる仕事ゼロ（commits 0 件かつ未コミット差分も無し）の場合のみ停止する。
- commit step を含まない実行（merge / sync / cleanup のみの選択実行）: 従来通り dirty-worktree / no-commits を停止条件として扱う。
- spec-only モード（feature == base）は従来通り全 preflight チェックを skip する。
- 上記方針に伴い、関係する単体テストの期待値を更新する。

## Out of Scope
- commit / merge / sync / cleanup の各ステップ本体のロジック変更。
- commit メッセージのカスタマイズ機能。
- finalize の選択実行モード（`--mode select`）に関する他用途拡張。
- spec 211 の文言修正（必要に応じて挙動更新を本 spec の Notes に記録するに留める）。

## Constraints
- alpha 版ポリシー: 後方互換コードは書かない。旧 preflight シグネチャ・期待値は残さず置き換える。
- 外部依存追加禁止（Node.js 組み込みモジュールのみ）。
- finalize 結果エンベロープの `result` / `reason` フィールドの値域は既存と互換を保つ（`preflight_failed` / `no-commits` / `dirty-worktree` を維持）。

## Design Principles
- **commit step が責任を持つ範囲は preflight で弾かない**: commit step が `git add -A` + commit するため、commit step を含む実行で dirty / no-commits を preflight が弾くのは責務分担として誤り。
- **事前検知 vs 事後失敗**: commit step を含まない実行で dirty を放置すると merge / sync で原因不明のエラーになるため、事前に preflight で停止する方が原因特定が容易。
- **真の no-op は引き続き弾く**: feature ブランチに何もコミットが無く、未コミット差分も無い状態で finalize を呼ぶのは誤操作なので停止する。

## Overview
### Modules
- finalize 実行モジュール（preflight 判定 + 各ステップ実行）。preflight 判定関数を、commit step 実行有無を入力に取れる形に拡張する。

### Data Flow
1. finalize 開始 → preflight 判定関数に「baseBranch / featureBranch / commit step が active か」を渡す。
2. preflight 判定関数が以下のマトリクスに従って `ok | no-commits | dirty-worktree | spec-only` を返す。
3. 不通過なら従来通り `preflight_failed` エンベロープで早期終了。通過なら commit → merge → sync → cleanup の各ステップへ進む。

### Decisions
- 判定マトリクス（commit step active / inactive × ahead × uncommitted）:

| commit step | ahead | uncommitted | 結果 |
|---|---|---|---|
| active | 0 | 0 | fail (`no-commits`) |
| active | 0 | >0 | ok |
| active | >0 | 0 | ok |
| active | >0 | >0 | ok |
| inactive | 0 | 0 | fail (`no-commits`) |
| inactive | 0 | >0 | fail (`dirty-worktree`) |
| inactive | >0 | 0 | ok |
| inactive | >0 | >0 | fail (`dirty-worktree`) |
| spec-only (feature == base) | - | - | ok (skipped) |

- preflight 判定関数の入力に commit step 実行可否を加えることで、判定式を 1 箇所に集約し、呼び出し側の重複条件分岐を避ける。

## Clarifications (Q&A)
- Q: abe0 (dirty-worktree 分岐) も本 spec で同時修正するか？
  - A: する。判定条件を一度で正しく書ける。Issue #232 本文も両分岐を一体で扱う方針を明記している。
- Q: commit step を含まない実行の dirty-worktree 扱いは？
  - A: 条件分岐方式。commit step を含む時は緩和、含まない時は dirty-worktree で停止。事前に弾く方が原因が明確（merge の事後エラーは状況依存で原因が分かりにくい）。
- Q: 既存テストの扱いは？
  - A: 新仕様で書き換える。alpha 版・後方互換コードは書かない方針に従う。

## Alternatives Considered
- **A: dirty-worktree 分岐を完全撤廃する**: シンプルだが commit step を含まない選択実行で merge が状況依存の理由で失敗するため、原因特定が困難になる。
- **B: commit step に dirty / no-commits を任せ、preflight は git write access のみに戻す**: A と同じ問題。
- **採用案: commit step 実行有無で分岐**: 責務分担が明確で、preflight の責務（後続ステップが安全に動かない状態を事前に弾く）に純化できる。

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
- **R1 (Must, Priority 1)**: `When` finalize が commit step を含めて起動され、`if` feature ブランチに未コミット差分が存在する `then` preflight は通過し、commit step が初コミットまたは追加コミットを作成すること。
- **R2 (Must, Priority 1)**: `When` finalize が commit step を含めて起動され、`if` feature ブランチが ahead==0 かつ未コミット差分も無い `then` preflight は `result=preflight_failed`, `reason=no-commits` で停止すること。
- **R3 (Must, Priority 2)**: `When` finalize が commit step を含めずに起動され、`if` feature ブランチに未コミット差分が存在する `then` preflight は `result=preflight_failed`, `reason=dirty-worktree` で停止し、`uncommittedFiles` を返すこと。
- **R4 (Must, Priority 2)**: `When` finalize が commit step を含めずに起動され、`if` feature ブランチが ahead==0 かつ未コミット差分も無い `then` preflight は `result=preflight_failed`, `reason=no-commits` で停止すること。
- **R5 (Should, Priority 3)**: spec-only モード（feature == base）では preflight 判定を skip し、`ok: true, skipped: "spec-only"` を返すこと。
- **R6 (Must, Priority 1)**: 上記挙動を網羅する単体テストを `tests/unit/flow/run-finalize-early-stop.test.js` に整備すること（commit step active / inactive の 2 軸網羅）。

## Acceptance Criteria
- AC1 (R1): 未コミット差分ありかつ ahead==0 の feature ブランチで `flow run finalize --mode all` を実行すると、`result=ok` で完了し、commit step が新コミットを作成する。
- AC2 (R1): 未コミット差分ありかつ ahead>0 の feature ブランチで `flow run finalize --mode all` を実行すると、`result=ok` で完了し、commit step が dirty 差分を吸収した追加コミットを作成する。
- AC3 (R2): ahead==0 かつ未コミット差分も無い feature ブランチで `flow run finalize --mode all` を実行すると、`result=preflight_failed`, `reason=no-commits` で停止する。
- AC4 (R3): 未コミット差分ありの feature ブランチで `flow run finalize --mode select --steps 2,3,4` を実行すると、`result=preflight_failed`, `reason=dirty-worktree` で停止し、`uncommittedFiles` に当該ファイルが含まれる。
- AC5 (R4): ahead==0 かつ未コミット差分も無い feature ブランチで `flow run finalize --mode select --steps 2,3,4` を実行すると、`result=preflight_failed`, `reason=no-commits` で停止する。
- AC6 (R5): feature ブランチ名が baseBranch と等しい状態で preflight を実行すると、`ok: true, skipped: "spec-only"` を返す（既存挙動の維持）。
- AC7 (R6): `tests/unit/flow/run-finalize-early-stop.test.js` に上記 AC1-AC6 を網羅する単体テストが追加され、全テストが PASS する。

## Implementation Targets
- `src/flow/lib/run-finalize.js`
- `tests/unit/flow/run-finalize-early-stop.test.js`

## Open Questions
- なし
