---
spec: 200-test-type-labels-parser
issue: 192
---

# Draft: test runner のテスト種別ラベル出力と preset 別 log parser

**開発種別:** enhancement

**目的:** `sdd-forge flow run tests` 実行時に flow.json の `test.summary` に unit / integration / acceptance の 3 種別件数が確実に記録されるようにし、preset 毎に独自 log parser を差し込めるプラグイン口を提供する。

## モード確認

本ドラフトは決定モードで作成している。ブレインストーミング段階ではなく、各項目は確定事項として記述する。

## 事前調査（Explore Before Asking）

ユーザー質問の前提として以下を確認済み（具体的な実装パスやクラス名は実装 phase で確定するため、ここでは要点のみ）:

- 現状 test runner は種別ごとの件数サマリを emit していない。
- `flow run tests` の log parser 層は種別ラベル行をパースする能力は既に備えているが、入力側のラベルが来ない。
- `test.summary` schema は spec 198 で unit / integration / acceptance + exitCode の 4 キーに確定済み。
- プロジェクトのテスト分類は unit / e2e / acceptance 相当で、integration と呼ばれるカテゴリは存在しない。
- preset は単一継承チェーン構造で、慣習的なディレクトリレイアウトにより解決される。

これら既読情報により、ユーザー確認は「解釈の妥当性」と「決定事項への異議の有無」に限定した。

## 背景

- spec 198 (#186) の REQ-P1-4 は `flow run tests` が 3 種別件数サマリを flow 状態に記録することを要求した。
- 現状の test runner は種別カウントを emit しないため、log parser は unit 相当しか拾えず spec 198 の要件を満たしていない。
- プロジェクトのテスト分類（unit / e2e / acceptance）と `test.summary` schema（unit / integration / acceptance）にずれがあり、semantic mapping が必要。

## 要件（優先度付き、When/shall 形式）

### Must（P1）

- **REQ-1 (Must)** When プロジェクトの test runner が全テスト実行を完了したとき、shall 実行結果サマリに unit / integration / acceptance の 3 種別件数を明示的なラベル行として標準出力へ emit する。カウントが 0 でも 0 として明示する。
- **REQ-2 (Must)** When `sdd-forge flow run tests` が本プロジェクトで正常完了したとき、shall flow.json の `test.summary` に unit / integration / acceptance / exitCode の 4 キーが数値で記録される。
- **REQ-3 (Must)** When log 入力にラベル行が存在するとき、shall 組込み log parser は unit / integration / acceptance を独立にパースし、欠損キーは summary に書き込まないフォールバック挙動を維持する。
- **REQ-4 (Must)** When 本変更が適用されたとき、shall 既存の TAP 出力・プロセス終了コード伝播・既存テスト群の pass 状態は一切変更されない。

### Should（P1: プラグイン機構）

- **REQ-5 (Should)** When 対象プロジェクトの preset が独自 log parser を提供しているとき、shall `flow run tests` はその parser を優先して適用し、提供がない場合は shall 組込みデフォルト parser を適用する。
- **REQ-6 (Should)** When preset が parser を提供するとき、shall parser は unit / integration / acceptance 3 キーのうち検出できたものだけを返す契約に従う（未検出キーは返却オブジェクトから省略する）。検証基準: ユニットテストで「2 キーのみ返す parser」「3 キー返す parser」「空オブジェクトを返す parser」の 3 ケースが期待どおり summary に反映されること。

### Out of Scope（P2 以降）

- 他言語 runner（jest / vitest / phpunit / pytest 等）向け組込 parser 実装。
- `test.summary` schema の変更（spec 198 で確定）。

## 受け入れ基準

1. 本プロジェクトで `sdd-forge flow run tests` を実行直後、flow.json の `test.summary` に unit / integration / acceptance / exitCode が揃って記録されている。
2. test runner 単体実行時、stdout にラベル行が 3 行出力される。
3. preset が独自 log parser を提供する経路が存在し、組込み ⇄ preset parser 切替が検証可能である。
4. 既存テスト一式が pass する。

## 影響範囲

- 対象プロジェクトの test runner（ラベル出力が追加される）。
- `flow run tests` の log parser 層（preset parser 解決の経路が追加される）。
- 既存の `test.summary` 書き込み挙動自体は変わらない（3 キーが常に揃うようになる）。

## Alternatives Considered

- **log parser 側でプロジェクトのテスト配置を走査して集計**: test runner とフロー側の責務が混ざるため却下。runner 側で種別ラベルを emit するほうが責務分離が保てる。
- **`test.summary` schema を unit/e2e/acceptance に変更**: spec 198 で確定済み、変更コストが大きく本 spec 範囲外。

## Future Extensibility

- プラグイン口の定義後、他言語 runner 向け組込 parser を後続 spec で追加できる。
- 契約は将来 parser の返却情報を増やせる形（初版の契約を壊さずにメソッド追加可能）を方針とする。

## Q&A

### Q1. 解釈確認（推奨根拠付き）
- **推奨**: Issue #192 を「①test runner のラベル出力」「②組込 parser の動作保証」「③preset 別 parser プラグイン口」の 3 点に分解する。
- **根拠**: Issue 本文のスコープ節が 3 箇条書きで明示されており、それぞれ受け入れ基準と 1:1 対応する。
- 回答: `[1] はい`（2026-04-20、ユーザー承認）

### Q2. e2e → integration の mapping（決定）
- **決定**: 本プロジェクトの e2e テスト群は `test.summary.integration` にカウントする。
- **根拠**: schema は spec 198 で固定。e2e は結合テスト相当で semantic ずれが最小、かつ schema 変更のほうがコストが大きい。

### Q3. ラベル欠損時の挙動（決定）
- **決定**: 欠損キーは summary に書き込まない。runner 側で 0 を明示出力するため本プロジェクトでは 3 キーが揃う。
- **根拠**: 「未計測」と「計測ゼロ」の区別を consumer 側に残す必要がある（parser 未提供の preset が将来存在し得る）。

### Q4. preset parser の発見方式（推奨、最終確定は実装時）
- **推奨**: preset 解決の既存慣習パターンに揃えた発見方式とする。
- **根拠**: 既存機構と一貫することで発見性と保守性が高まる。詳細な配置は実装 phase で確定する。

## Open Questions

- なし（Q4 を推奨案として決定扱い）。

## User Confirmation

- [x] User approved this draft (autoApprove)
- 承認日: 2026-04-20
