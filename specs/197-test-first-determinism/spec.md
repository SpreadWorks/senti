# Feature Specification: 197-test-first-determinism

**Feature Branch**: `feature/197-test-first-determinism`
**Created**: 2026-04-20
**Status**: Ready for Review
**Input**: GitHub Issue #185 (cac6/T4)

## Goal

cac6 分解タスク T4 の **Phase 1 骨格**。test-first 原則を機械化するための step 構造・phase 割当・summary 合算の基盤を導入する。具体的には以下 3 点を満たす:

1. task step 列にテスト作成・実装・テスト実行の 3 段階分離（plan / addition 両 origin で統一）
2. 親 flow に integration 段階 4 step を追加し、全 task 完了後 review 前に挿入
3. task 完了時の test summary を親 state に合算する副作用を導入

テスト実行 CLI 本体・context フィルタ本体・addition auto-draft 本体は、本 spec の step 構造に乗る形で **Phase 2 として別タスク** で扱う（Out of Scope 参照）。Phase 1 は構造と状態管理を確立し、後続が振る舞いを載せる。

## Scope

1. task step 列の再定義（plan / addition 両 origin で、テスト作成・実装・テスト実行を分離）
2. task→親 test summary の自動合算（task 完了契機、null 耐性）
3. 親 flow に integration 段階 4 step の追加
4. 公開 API 契約の formal tests 追加（step 列・phase 割当・合算ロジック）

## Out of Scope（Phase 2 で別タスク）

- **テスト実行段階 CLI 本体**: 実テストコマンドの起動・結果記録・exit code 反映（REQ-2 は Phase 2 で実装）
- **テスト作成段階 context フィルタ本体**: 実装差分の構造的除外 + skill ルール明文化（REQ-3 は Phase 2 で実装）
- **addition origin 自律化本体**: auto-draft + gate 厳格 + FAIL リトライ上限 escalate（REQ-7 は Phase 2 で実装）
- **integration 段階の skip 初期化ロジック本体**: tasks[] 空時の初期値調整（Phase 2 で実装）
- 実装中発生 task を plan への差分追記として扱う replan 機構（別タスク）
- task step の命名整理（別タスク）
- guardrail 3-tier 化（cac6/T3）
- spec.json プライマリ化（cac6/T8）
- skill 統合（cac6/T7）
- 旧 flow.json の一括マイグレーション（cac6/T11）
- 並列 task 実行（9c3c で検討）

## Clarifications (Q&A)

- Q: plan / addition 両 origin で同じ step 分解を適用するか？
  - A: 同じ順序で適用。origin 非依存の機械化。
- Q: テスト実行を既存の実装確認コマンドに相乗りさせるか？
  - A: 新規 CLI コマンドとして分離。責務単一化のため。
- Q: テスト作成段階の context フィルタは skill 明文化のみで足りるか？
  - A: 不十分。CLI レイヤで構造的に除外し、skill で補強する二層方式。
- Q: task→親 summary は動的集計か、永続的合算か？
  - A: 永続的合算。task 完了時に親 summary へ加算副作用。
- Q: integration 段階は T4 で扱うか、別タスクに切るか？
  - A: Issue 本文に明記されており、cac6 の他タスクにも枠が無いため T4 で扱う。
- Q: addition origin は残すか廃止するか？
  - A: 残す。auto-draft + gate 厳格で運用。失敗時のみ user escalate。
- Q: テストは formal tests か spec-local tests か？
  - A: formal tests（公開 API 契約のため）。

## Alternatives Considered

1. 既存 impl step にテスト機能を内部フラグで混載 — 却下。単一責務違反で context 制御と実行責務の線引きが曖昧化。
2. 既存の実装確認コマンドを拡張してテスト実行も担わせる — 却下。カウント用途の既存コマンドに再責務を載せると過剰結合。
3. テスト作成段階の context 制御を skill 明文化のみで済ます — 却下。機械的強制力が無く、他経路での diff 取得を塞げない。
4. context 制御を CLI フィルタのみで強制 — 却下。skill 明文化による補強が必要。
5. addition origin を廃止し、発生時は plan 段階に戻す厳格モデル — 却下。軽微な追加まで plan 戻りは過剰コスト。
6. integration 段階を別タスクに切る — 却下。Issue 本文に含まれ、他 10 タスクにも枠が無い。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: draft から要件・Out of Scope・移行計画を継承。auto mode 下で方針合意済み。

## Requirements

本 spec は Phase 1（骨格）のみを扱う。全要件は When/If + shall で記述する。優先度は P1 = 必須コア、P2 = 必須派生、P3 = テスト/運用。

### P1 — コア（step 構造）

- **REQ-1** When 新規 task が作成される時、shall task の step 列はテスト作成段階・実装段階・テスト実行段階の 3 つを含み、この順序で並ぶ。plan origin と addition origin の両方で同じ順序を適用する。step 列の定数定義と `buildInitialTaskSteps` のマッピングにこの変更を反映する。
- **REQ-2** When 親 flow の step 列が初期化される時、shall review 段階の前に integration 段階 4 段階（統合テスト作成・統合テスト実行・全 task テスト横断実行・評価）が順序通り並ぶ。phase 割当は `impl` とする。

### P2 — 派生機能

- **REQ-3** When task の完了処理が実行される時、shall 当該 task の test summary に格納された件数（unit / integration / acceptance）を親 state の対応フィールドに整数加算する。task の summary が null の場合、合算は行わず親 summary は変化しない。
- **REQ-4** When current task が存在しない状態で test summary 設定が呼ばれた時、shall 結果は親 state に直接記録される（既存 T2 の scope 推論契約を継承）。

### P3 — テスト

- **REQ-5** When 本 spec の実装を成果物に含める時、shall 以下の観点を網羅する自動テストが存在する:
  - task step 列の構成と phase 割当
  - integration 4 段階の step 構成と `PHASE_MAP` 割当
  - task→親 summary 合算（加算と null 耐性）
  - current task 不在時の summary 直接記録
- **REQ-6** When プロジェクト標準のテスト実行コマンドが実行された時、shall 追加・既存テストは全て終了コード 0 で PASS する。既存テストの期待値は変更せず、schema 整合のための fixture 調整（配列長 assertion の `.length` 参照化等）のみを許容する。

## Acceptance Criteria

- 新規 task 作成時に step 列が「テスト作成 → 実装 → テスト実行 → review → update-overview」（addition origin の場合は前段に draft / approval 系を含む）となる
- 親 flow の step 列に review 前の integration 段階 4 step が順序通り存在し、それぞれ `impl` phase に割り当てられる
- task 完了時に、task の test summary が親 state の test summary に加算されている。task summary が null の場合は親は不変
- current task 不在時の `setTestSummary` は親 state に直接書き込まれる
- プロジェクト標準のテストコマンドで追加・既存テスト全てが PASS する

## Test Strategy

### 配置
task step 列・CLI 契約・phase 遷移・合算は公開 API 契約のため、プロジェクト標準の formal tests（unit と e2e の階層）に配置する。spec verification tests (`specs/197/tests/`) は作らない。

### 観点
1. task step 列の構成と phase 割当 — 各 origin で期待される順序
2. integration 4 段階の FLOW_STEPS 配置と PHASE_MAP 割当
3. task→親 summary 合算 — 加算・null 耐性
4. current task 不在時の summary 直接記録

### 既存テスト更新方針
fixture / 状態モックに新 step 列を反映する。**テスト期待値の変更は行わない**。期待値変更が必要になる場合は、当該 Requirement の誤りとして spec を修正する。

## Why This Approach

1. **3 段階分離 + CLI 駆動を選ぶ理由**: AI が実装を見てからテストを書く「fit-to-impl」が構造的に成立しないようにするには、文書ルールでは不十分で、情報経路と実行経路の両方をツール側で制御する必要がある。
2. **context フィルタを CLI と skill の二層にする理由**: 片方では抜け道が残る。CLI フィルタで情報経路を物理的に塞ぎ、skill で AI の行動方針を明文化することで二重化する。
3. **合算方式を選ぶ理由**: 親 summary 参照時に都度集計すると多箇所に集計ロジックが散るため、task 完了の 1 箇所で副作用として加算する方が凝集度が高い。
4. **integration 段階を親 flow に追加する理由**: 全 task 完了後の regression 検出と統合テストは task ごとに閉じられず、親粒度の段階として分離する方が責務が明確になる。task を持たない flow は skip として影響を与えない。
5. **addition origin を残す理由**: 実装現実において追加 task の発生は避けがたい。完全封鎖すると spec の過剰詳細化圧力になる。gate 厳格で品質を担保する方が運用コストが低い。
6. **formal tests を選ぶ理由**: task step 列と CLI 契約は将来の破壊検出に価値があり、spec-local tests ではなくプロジェクト標準テストに置くのが適切。

## Migration Plan

### 実装内部の破壊的変更

1. task step 列を再定義する。現時点で task 機能を使用中の active flow は 1 本（196）のみで、196 は最終コミット前なので影響は実質無し。必要な場合のみ手動で step 列を再整備する。
2. 親 flow step 列に integration 段階 4 step を追加する。task を持たない既存 flow は skip 状態で初期化され挙動変化なし。task を持つ flow（196 以外に存在しない想定）は T11 の移行スクリプトで一括対応予定。
3. PR 本文に他 active flow 所有者向けの手動移行手順を記載する:
   - 当該 flow.json に integration 段階 4 step を skip 状態で追加
   - task を持つ場合は task の step 列を新形式に再構築
   - `sdd-forge flow get status` が正常終了することを確認

### CLI インターフェース互換性

- 既存の flow 系 CLI の外部挙動（引数・終了コード・出力 JSON 形式）は変更しない
- テスト実行 CLI は新設。既存 CLI を置き換えない
- context 取得 API に phase 別 filter を追加。filter ルール未定義時の既存挙動は変化なし

## Open Questions

なし。実装中に判明した追加論点は `issue-log.json` に記録する。
