# Feature Specification: 175-fix-flow-test-phase-quality

**Feature Branch**: `feature/175-fix-flow-test-phase-quality`
**Created**: 2026-04-14
**Status**: Draft
**Input**: Issue #146

## Goal

flow テストフェーズに存在する3点のバグを修正し、AI が適切な選択肢をユーザーに提示してからテスト方針を決定するよう改善する。また、gate-impl がテスト実行要件を diff から誤判定しないよう、テスト実行証跡を提供する新コマンドを追加する。

## Why This Approach

- **plan.test-mode 設問変更**: 「テストコードを作成するか」という設問は既存テストを実行するだけという選択肢がなく不適切。他の plan.* プロンプトと同じ実行／スキップの二択に統一することで一貫性を確保する
- **CRITICAL STOP 追加**: flow-finalize で同じ問題が CRITICAL STOP により解決済みであり、同パターンをテストフェーズにも適用する
- **新コマンド追加**: テスト実行結果は git diff に現れないため、AI ヒューリスティックに頼らず実行証跡を返す専用コマンドを設けて機械的に取得する

## Scope

1. `plan.test-mode` プロンプト定義の変更（ja/en）
2. flow-plan SKILL.md テンプレートへの CRITICAL STOP 追加
3. `sdd-forge flow get test-result` 新コマンドの実装
4. `buildImplCheckPrompt` がテスト実行証跡を参照するよう変更
5. flow-plan SKILL.md テンプレートへのテストログ保存指示の追加
6. `sdd-forge upgrade` の実行によるプロジェクトスキルへの反映

## Impact on Existing Features

- **`sdd-forge flow get prompt plan.test-mode`**: 返す description と choices のテキストが変わる。既存の SKILL.md を使用しているプロジェクトは `sdd-forge upgrade` を実行しないと新しい設問が反映されない
- **`sdd-forge flow run gate --phase impl`**: テスト実行証跡なし時の動作が変わる。テスト実行要件は SKIP（未検証）として扱われるため、従来より PASS/FAIL の判定数が減少しうる。誤判定は発生しない
- **`sdd-forge flow get test-result`**: 新規追加コマンド。既存コマンドへの影響なし
- **その他の flow get/set/run コマンド**: 変更なし

## Out of Scope

- テスト実行エンジン自体の変更
- テストフェーズ以外の flow ステップへの変更
- gate-impl の構造的なリファクタリング

## Requirements

優先順位:
- P1: plan.test-mode 設問の変更（既存テスト実行の選択肢が欠如しているため即影響あり）
- P2: flow-plan test フェーズの CRITICAL STOP 追加（AI の自動判断を防ぐ安全装置）
- P3: gate-impl のテスト実行要件検証改善（新コマンド作成を伴う最も影響範囲が広い変更）

### P1: plan.test-mode 設問変更

- R1: When `sdd-forge flow get prompt plan.test-mode` が呼ばれたとき、description は「テストを実行するか選択してください。」を返すものとする
- R2: When ja 版の選択肢が提示されるとき、[1] 実行する [2] 実行しない [3] その他 を含むものとする
- R3: When en 版の `plan.test-mode` が呼ばれたとき、description は "Run tests?" を返し、選択肢は [1] Run [2] Skip [3] Other を含むものとする

### P2: CRITICAL STOP 追加

- R4: When AI が flow-plan のテストフェーズに入ったとき、`plan.test-mode` をユーザーに提示して選択を受け取る前に、テスト方針を自動決定してはならない
- R5: When flow-plan SKILL.md テンプレートが更新されるとき、テストフェーズ冒頭に CRITICAL STOP マーカーを追加するものとする

### P3: gate-impl のテスト実行要件検証改善

- R6: When `sdd-forge flow get test-result` が呼ばれたとき、flow.json のテスト summary とテスト実行ログの内容を他の flow get コマンドと同じ形式で返すものとする
- R7: If テスト実行ログが存在しないとき、`sdd-forge flow get test-result` は summary のみを返し、ログ内容は null とするものとする（exit code 0）
- R7a: If flow.json が存在しないとき、`sdd-forge flow get test-result` は非ゼロ exit code で終了し、エラーを返すものとする
- R8: When gate-impl がテスト実行要件を検証するとき、diff だけでなくテスト実行証跡（`flow get test-result` の戻り値）を参照して判定するものとする
- R9: If テスト実行証跡が存在しないとき、gate-impl はテスト実行要件を SKIP（未検証）として扱い、diff のみで検証可能な要件だけを PASS/FAIL 判定するものとする
- R10: When テストフェーズでテストを実行するとき、テスト出力を設定の `agent.workDir` 配下のログファイルに保存するものとする

## Acceptance Criteria

- AC1: `sdd-forge flow get prompt plan.test-mode` を実行したとき、description が「テストを実行するか選択してください。」を含み、choices が [実行する, 実行しない, その他] を含むこと
- AC2: flow-plan SKILL.md のテストフェーズ冒頭に CRITICAL STOP マーカーが存在すること
- AC3: `sdd-forge flow get test-result` を実行したとき、`ok: true` と `key: "test-result"` を含む JSON が返されること
- AC4: `sdd-forge flow get test-result` をログファイルが存在しない状態で実行したとき、エラーにならず `log: null` を含む結果が返されること
- AC5: gate-impl がテスト実行証跡ありで実行されたとき、証跡の内容がプロンプトに含まれること

## Clarifications (Q&A)

- Q: gate-impl のテスト実行要件を判定する際、AI ヒューリスティックと専用コマンドのどちらを使うか？
  - A: 専用コマンド `sdd-forge flow get test-result` を作成し、その戻り値で判定する。AI ヒューリスティックへの依存を排除する

- Q: テストログの保存先はどこか？
  - A: 設定の `agent.workDir`（デフォルト `.tmp`）配下。既存のエージェントログと同じディレクトリ配下に統一する

## Alternatives Considered

- **AI に SKIP 判断させる案（不採用）**: プロンプトに「実行証跡が必要な要件は SKIP せよ」と追加する案。AI が要件テキストから推測するためヒューリスティックであり、判定が不安定。専用コマンドにより機械的に取得する案を採用した
- **spec に `[execution]` タグを付ける案（不採用）**: spec 記述側に変更が必要。既存 spec の改修が必要になるため、新コマンド追加のみで対処できる案を採用した

## Test Strategy

本 spec の変更はプロンプト定義・SKILL.md テンプレート・新コマンドが対象。
テストの配置基準に従い以下を行う:

- `tests/` (formal): `flow get test-result` の公開インターフェース契約テスト（今後の変更でも壊れれば常にバグ）
- `specs/175-fix-flow-test-phase-quality/tests/`: plan.test-mode の設問変更確認、gate-impl との結合確認

## Open Questions

なし

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-14
- Notes: P1/P2/P3 の3点修正。P3 は新コマンド `flow get test-result` 追加により AI ヒューリスティック排除。
