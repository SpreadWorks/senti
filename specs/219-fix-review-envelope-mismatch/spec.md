# Feature Specification: 219-fix-review-envelope-mismatch

**Feature Branch**: `feature/219-fix-review-envelope-mismatch`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #236

## Goal
`sdd-forge flow run review` の impl-phase 実行において、返却される envelope の提案カウントと、spec ディレクトリに書き出される review 結果ファイルの内容を全ての実行経路で整合させる。既知の副次バグとして、scope フィルタ除外後の提案と最終検証フェーズの verdict の紐付けで位置ずれが起こりうる点も同時に解消する。

## Background
impl-phase の review 実行は内部で複数の early return 経路を持ち、そのうち一部の経路では現在実行分の結果で review 結果ファイルを上書きせずに終了する。結果として、過去実行の成果物が spec ディレクトリに残留し、envelope が報告する「採用可能な提案 0 件」と、ファイルに記載された複数提案が乖離する split 表示が発生する。finalize に進むと残留したファイルが commit されるため、spec アーティファクトの記録としてノイズが混入する。

加えて、最終検証フェーズに渡す検証対象を scope フィルタ前の全 AI 出力としつつ、得られた verdict を scope フィルタ後の提案列に index で紐付ける実装は、除外による位置ずれを介して verdict が別提案に付与される潜在バグを含む。

## Scope
- impl-phase の review 実行（subcommand 指定なし）
- envelope と review 結果ファイル本文の一致保証
- scope フィルタ除外に伴う最終検証フェーズの入力再構成

## Out of Scope
- envelope への新フィールド（`reviewedFiles` / `inScopeFiles` 等）追加
- AI 向け prompt の in-scope 指示強化
- 既にコミット済みの過去 review 結果ファイルの事後クリーンアップ
- test phase review / spec phase review の動作変更
- draft gate、impl gate の動作変更

## Constraints
- 外部依存を追加しない（Node.js 組み込みモジュールのみ）。
- 既存の CLI コマンド名・サブコマンド・オプションは変更しない（後方互換）。
- envelope の出力キー構造（`proposalCount` / `approved` / `rejected` / `changed` / `result` / `next`）を変更しない。
- alpha ポリシーに従い、旧挙動の保持コードを残さない。

## Design Principles
- 全 early return 経路で review 結果ファイルの書き込みを必ず 1 回行うことで、残留ファイルの発生源を排除する。
- 「提案 0 件」状態の表現は envelope（数値 0）と本文（固定行 1 行以上）の両方に並立させ、いずれ単独の参照でも状態判定が可能な冗長性を持たせる。
- 最終検証フェーズの入力は scope フィルタ後の集合を単一の真実として扱い、AI prompt と verdict 解析の両方を同一集合の index で揃える。

## Overview
### Modules
- `src/flow/commands/review.js`: 本 spec の主対象。early return 経路の集約、review 結果ファイル本文生成、最終検証フェーズの入力組立。
- `src/flow/lib/run-review.js`: envelope 生成の対向側。本 spec では挙動変更なし（regex は現状のまま通る想定）。
- `tests/unit/flow/review/` 配下: 本 spec で追加される unit テストの配置先（既存配置と同慣習）。

### Data Flow
1. review 実行開始 → base diff を取得。
2. Draft AI 呼び出し → 生出力を取得。
3. `NO_PROPOSALS` マーカー検出、あるいは構造的提案 parse 結果により、以降の分岐に入る。
4. scope フィルタで提案を触れたファイルの集合に限定する。
5. 採用可能提案が 0 件なら終了（本 spec の変更対象: この時点で結果ファイルを必ず上書きする）。
6. 1 件以上残った場合、scope フィルタ後の提案のみを含む最終検証 prompt を組み立てて AI に渡し、verdict を取得する。
7. 最終検証 AI の verdict 解析結果を、同じ scope フィルタ後集合の位置順で紐付けて結果ファイルと envelope に反映する。

### Decisions
- 結果ファイル上書きの責務は、review 実行の各 terminal point（現行の early return 相当箇所と通常完了箇所）で必ず 1 回だけ呼ぶ形に集約する。
- 「提案 0 件」時の本文は、固定識別可能な文字列を 1 行以上含める。現状の `# Code Review Results` 単独本文は不許可。
- 最終検証フェーズでは、scope フィルタ後の提案を番号付きリスト化したテキストを AI に渡す。AI 側で番号と提案が 1 対 1 に対応する前提となり、verdict 解析の index は提案リストと同じ 0 起点の配列位置を参照する。

## Clarifications (Q&A)
- Q1 (draft-phase): 修正スコープをどこまで含めるか。
  - A: メイン修正（envelope と結果ファイルの一致）+ 最終検証フェーズの index ずれ fix。envelope 拡張、AI prompt 強化は別 spec。
- Q2 (draft-phase): テスト方針は unit / 統合のどちらを採るか。
  - A: 外部プロセスを呼ばない unit テストのみ。
- Q3 (draft-phase): 提案 0 件時の結果ファイル本文の要件は。
  - A: ヘッダに加えて「採用可能な提案は 0 件である」旨を示す固定文字列の本文行を最低 1 行含める。

## Alternatives Considered
- 案 A (envelope 拡張): envelope に `reviewedFiles` / `inScopeFiles` を追加して skill 側で整合性チェック。却下理由: skill 側の利用形態が未確定、かつ不整合の根因（終了経路ごとの上書き漏れ）を直接解決しない対症療法である。
- 案 B (AI prompt での scope 指示強化): AI に対象ファイル一覧を渡して out-of-scope を生成させない。却下理由: AI の確率的挙動に依存し、決定論的整合性を保証できない。フォールバック安全網の scope フィルタを同時に残す必要があるため本 bug の根因は解消しない。
- 採用案 (現 spec): 終了経路の上書き責務を集約する構造変更 + 最終検証フェーズの入力を scope フィルタ後集合に限定する。これは副作用の発生源側を塞ぐ設計変更であり、単一の真実（フィルタ後集合）を保つため、今後 AI 出力が変化してもファイル・envelope 不整合が再発しにくい。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: Draft Q&A で合意済みの方針に基づく（Q1=[2], Q2=[1]）。Spec gate PASS 後、approval ステップにてユーザーが [1] 承認を選択。

## Requirements
- **R1 (P1)**: When impl-phase の review 実行が正常終了する時、当該実行は `specs/<active-spec>/review.md` を 1 回書き込み、書き込み内容は当該実行の検証結果のみを反映していなければならない（過去実行の内容が残留してはならない）。
- **R2 (P2)**: When `sdd-forge flow run review`（impl-phase）の envelope が `approved: 0` を報告する時、書き出された review 結果ファイルの本文は「採用可能な提案は 0 件である」旨を示す固定の識別可能な行を 1 行以上含んでいなければならない。ヘッダ行のみの本文は許容しない。
- **R3 (P3)**: When 当該実行の envelope が `approved: N_a`、`rejected: N_r` を報告する時、同実行で書き出された review 結果ファイルの本文に含まれる提案エントリ数は `N_a + N_r` と等しくなければならない。
- **R4 (P4)**: When 最終検証フェーズに入る時、AI に渡される検証対象の提案集合は scope フィルタによって除外された提案を含まず、かつ verdict 解析結果の要素順は当該フィルタ後集合の配列位置と 1 対 1 で対応していなければならない。
- **R5 (P5)**: R1〜R4 の振る舞いを検証する自動テストは、外部プロセス（AI CLI、git、ネットワーク呼び出し）を起動せず完結していなければならない。

## Acceptance Criteria
- AC1 (R1/R3): `review.md` 書き込みロジックを単独で呼び出し、0 件入力と N 件入力の双方で期待される本文が生成されることを unit テストで確認する。特に 0 件入力時はヘッダ + 0 件マーカー行が出力されること。
- AC2 (R1): review 実行の各終了経路（AI が `NO_PROPOSALS` を返す / 構造的 parse 結果が 0 件 / scope フィルタで全除外 / 通常完了）で、結果ファイル書き込みが 1 回だけ呼び出されることを unit テストで確認する。
- AC3 (R2): 0 件の結果ファイル本文に対し、envelope 側の `approved: 0` と本文の 0 件マーカーが共存することを確認する回帰テストを置く。
- AC4 (R3): N 件（approved / rejected の混在を含む）の結果ファイル本文のエントリ数が `approved + rejected` と等しいことを検証する。
- AC5 (R4): 最終検証フェーズ用の prompt 構築ロジックに scope フィルタ後集合を渡すと、prompt 本文に除外済み提案の本文が含まれないこと、および verdict→提案 の位置対応が想定どおりに機能することを unit テストで確認する（AI 応答は固定文字列で擬似供給する）。
- AC6 (R5): 上記テストは `npm test`（デフォルト実行、`tests/agent/` を含まない）のスコープ内でパスし、`claude` / `codex` を含む外部 CLI を呼び出さない。

## Implementation Targets
- `src/flow/commands/review.js`
  - `formatReviewMd` の 0 件入力時挙動の変更
  - `writeReviewMd` を各 terminal point で呼ぶよう、`runReviewLoop` の分岐を整理
  - 最終検証フェーズ用の prompt 構築を、scope フィルタ後の提案から再生成する形に変更
- `tests/unit/flow/review/` 配下の新規 unit テストファイル（`review-md-format.test.js` / `review-loop-write-paths.test.js` / `review-final-prompt.test.js` 相当の論理単位、正式名はテスト記述時に決定）

## Open Questions
- なし
