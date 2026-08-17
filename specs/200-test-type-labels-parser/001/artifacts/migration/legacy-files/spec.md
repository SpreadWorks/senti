# Feature Specification: 200-test-type-labels-parser

**Feature Branch**: `feature/200-test-type-labels-parser`
**Created**: 2026-04-20
**Status**: Ready for Approval
**Input**: GitHub Issue #192

## Goal

`sdd-forge flow run tests` 実行時に flow.json の `test.summary` へ unit / integration / acceptance の 3 種別件数を確実に記録できるようにする。あわせて preset ごとに独自 log parser を差し込めるプラグイン口を提供し、将来の多言語 test runner 対応の土台を整える。

## Scope

- 対象プロジェクトの test runner に対し、実行サマリへ種別ラベル行（unit / integration / acceptance の 3 行）を emit する改修。
- `flow run tests` の log parser 層に、preset が独自 parser を差し込める解決経路を追加。
- 組込み（node 標準 runner 想定）デフォルト parser の動作保証・テスト強化。
- 本プロジェクトのテスト分類（unit / e2e / acceptance）→ `test.summary` schema（unit / integration / acceptance）の semantic mapping を確定（e2e → integration）。

## Out of Scope

- 他言語 runner（jest / vitest / phpunit / pytest 等）向け組込 parser 実装。本 spec ではプラグイン口の提供のみ。
- `test.summary` schema の変更（spec 198 で確定済み）。
- flow.json の他フィールド（exitCode 以外の詳細メトリクス）の拡張。

## Clarifications (Q&A)

- Q: プロジェクトの e2e テストは `test.summary` のどのキーにカウントするか?
  - A: `integration` にカウントする（schema は spec 198 で固定、e2e は結合テスト相当で semantic ずれが最小）。
- Q: ラベル行が欠損したキーは `test.summary` にどう反映されるか?
  - A: 欠損キーは summary に書き込まない。runner 側で 0 を明示出力するため本プロジェクトでは 3 キーが揃う。
- Q: preset parser の発見方式は?
  - A: preset 解決の既存慣習パターンに揃える。詳細配置は実装 phase で確定。
- Q: 契約の将来拡張時の互換性は?
  - A: 初版は 3 キー件数の返却のみ。追加情報は新メソッドを足す形で既存契約を壊さない方針。

## Alternatives Considered

- **log parser 側でプロジェクトのテスト配置を走査**: test runner とフロー側の責務が混ざる。runner 側でラベル emit するほうが責務分離が保てるため却下。
- **schema を unit/e2e/acceptance に変更**: spec 198 で確定済み。変更コストが大きく却下。
- **カスタムレポータ機構を利用**: 実装コストが高く、既存 TAP 出力との共存も難しいため却下（ラベル行の追加が最もシンプル）。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-20
- Notes: ユーザー承認済み（autoApprove mode でドラフト→spec 経て最終確認）。

## Requirements

- **REQ-1 (Must / P1)** When プロジェクトの test runner が全テスト実行を完了したとき、shall 実行結果サマリに unit / integration / acceptance の 3 種別件数を明示的なラベル行として標準出力へ emit する（カウントが 0 でも 0 として明示する）。
- **REQ-2 (Must / P1)** When `sdd-forge flow run tests` が本プロジェクトで正常完了したとき、shall flow.json の `test.summary` に unit / integration / acceptance / exitCode の 4 キーが数値で記録される。
- **REQ-3 (Must / P1)** When 入力 log にラベル行が含まれるとき、shall 組込み log parser は unit / integration / acceptance を独立にパースし、欠損キーは summary に書き込まないフォールバック挙動を維持する。
- **REQ-4 (Must / P1)** When 本変更が適用されたとき、shall 既存の TAP 出力・プロセス終了コード伝播・既存テスト群の pass 状態は一切変更されない。
- **REQ-5 (Should / P2)** When 対象プロジェクトの preset が独自 log parser を提供しているとき、shall `flow run tests` はその parser を優先して適用し、提供がない場合は shall 組込みデフォルト parser を適用する。
- **REQ-6 (Should / P2)** When preset が parser を提供するとき、shall parser は unit / integration / acceptance 3 キーのうち検出できたものだけを返す契約に従う（未検出キーは返却オブジェクトから省略する）。

## Acceptance Criteria

1. 本プロジェクトで `sdd-forge flow run tests` を実行直後、flow.json の `test.summary` に unit / integration / acceptance / exitCode が全て数値として記録されている。
2. プロジェクトの test runner 単体実行時、stdout にラベル行が 3 行出力される（いずれのカウントが 0 でも明示される）。
3. preset が独自 log parser を提供する経路が存在し、ユニットテストで以下 3 ケースが全てパスする:
   - 「3 キー返す parser」→ summary に 3 キー反映
   - 「2 キー返す parser」→ summary に 2 キー反映、残り 1 キーは未記録
   - 「空オブジェクトを返す parser」→ summary に件数キーは書かれない（`exitCode` のみ）
4. 既存の unit / e2e / acceptance テスト一式が pass する。
5. `sdd-forge flow run tests` の終了コードは子プロセスの終了コードをそのまま伝播する（既存挙動維持）。

## Open Questions

- preset parser の具体的な配置パス（preset ディレクトリ内の慣習的ファイル名）は、既存の preset 解決パターンを実装 phase で参照して最終確定する。選定方針（既存 DataSource / テンプレートの解決慣習に揃える）は決定済み。
