# Feature Specification: 193-fix-issue-log-test-leak

**Feature Branch**: `feature/193-fix-issue-log-test-leak`
**Created**: 2026-04-19
**Status**: Approved
**Input**: issue #176

## Goal

`flow set issue-log` コマンドに入力バリデーションを追加し、placeholder 的な短文 reason（"first", "second", "test", "wrong scope" 等）が実 spec の `issue-log.json` に混入するのを防ぐ。

## Scope

- P1: `flow set issue-log` の `reason` 引数に最小長バリデーションを追加する。
- P2: `flow set issue-log` の任意引数 `trigger` / `resolution` / `guardrail-candidate` に最小長バリデーションを追加する。
- P3: 既存呼び出し箇所（テストコード・SDD スキルの例示）を新バリデーション仕様に整合させる。
- P4: 新バリデーションのユニットテストを追加する。

## Out of Scope

- `SDD_FORGE_ISSUE_LOG_SINK=devnull` 等のテスト用 sink 分離機構の導入。
- 既に混入済みの placeholder エントリ（`specs/164-*/issue-log.json` 等）のクリーンアップ。
- `flow set issue-log` 以外のコマンド（`note`, `summary`, `request` 等）への同種バリデーション波及。
- placeholder キーワード辞書によるブロック機構。

## Why This Approach

- 実利用における issue-log の reason は `run gate` post hook 経由でも手動記録でも常に十分長い（典型的に 100 文字超）。placeholder 的な短文は 12 文字以下に集中しており、最小長で両者を明確に弁別できる。
- 長さチェックは実装・テストともに最小で、alpha 版ポリシー「過剰な防御コードを書かない」に合致する。
- sink 環境変数は「テスト経路を守る」目的に限定され、手動 CLI 実行時の誤入力を防げない。入力境界での拒否の方が網羅的。
- `src/flow/lib/set-issue-log.js` は現状 `--step` / `--reason` の非 null チェックのみを行っており、同じファイル内での拡張で完結する（分散なし）。

## Clarifications (Q&A)

- Q: 最小長の閾値は？
  - A: `reason` は trim 後 20 文字以上、任意フィールド（`trigger` / `resolution` / `guardrail-candidate`）は trim 後 10 文字以上。
- Q: sink 機構を併設するか？
  - A: しない。バリデーションだけで目的を達する。
- Q: 既存の placeholder 混入エントリをクリーンアップするか？
  - A: しない。issue #176 本文で別途判断と明示されているため、本 spec では扱わない。
- Q: 任意フィールドにも閾値を設けるか？
  - A: 設ける。reason だけ守っても任意フィールドが placeholder だらけになれば同じ問題が再発する。
- Q: エラーコード体系は？
  - A: `INVALID_REASON`（`reason` 長さ違反）、`INVALID_FIELD`（任意フィールド長さ違反）の 2 種を envelope の `errors[].code` に設定する。

## Alternatives Considered

1. テスト用 sink 環境変数（`SDD_FORGE_ISSUE_LOG_SINK=devnull`）。却下: 手動 CLI 誤入力を防げず、テストは既に作業ルートで隔離済み。
2. placeholder キーワード辞書によるブロック方式。却下: 保守負担が高く、辞書外の別短文を素通りさせる。
3. 最小長バリデーション（本案）。採用: 誤検知が極小で実装・テストコストも最小。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-19
- Notes: autoApprove mode による自動承認。

## Requirements

### P1（必須）: reason 最小長バリデーション

- **When:** 利用者または post hook が `flow set issue-log` を呼び出したとき
- **If:** 指定された `reason` を trim した長さが 20 文字未満であるとき
- **Shall:** コマンドは非ゼロ終了コードと `{ok: false, errors: [{code: "INVALID_REASON", ...}]}` envelope を返し、`issue-log.json` への書き込みを一切行わない。

### P2（必須）: 任意フィールド最小長バリデーション

- **When:** 利用者または post hook が `flow set issue-log` に任意フィールド（`trigger` / `resolution` / `guardrail-candidate`）を指定したとき
- **If:** 指定された任意フィールド値を trim した長さが 10 文字未満であるとき
- **Shall:** コマンドは非ゼロ終了コードと `{ok: false, errors: [{code: "INVALID_FIELD", ...}]}` envelope を返し、`issue-log.json` への書き込みを一切行わない。

### P3（必須）: 既存呼び出し箇所の整合

- **When:** 本 spec の実装が適用されたとき
- **If:** リポジトリ内の既存呼び出し（`tests/unit/flow/set-issue-log.test.js`、SDD スキル内の実行例示）が新閾値を満たさない短文を含むとき
- **Shall:** 当該短文を新閾値を満たす説明的な文字列へ書き換える。

### P4（必須）: バリデーションのテストカバレッジ

- **When:** P1/P2 の実装が完了したとき
- **Shall:** 以下のユニットテストを追加する。
  - `reason` が 20 文字未満の場合に `ok: false` + `INVALID_REASON` が返り `issue-log.json` が作成されない。
  - 任意フィールドが 10 文字未満の場合に `ok: false` + `INVALID_FIELD` が返り書き込みが行われない。
  - `reason` 20 文字ぴったりは成功する。
  - 任意フィールド 10 文字ぴったりは成功する。

## Acceptance Criteria

- `node src/sdd-forge.js flow set issue-log --step draft --reason "first"` を隔離環境で実行すると非ゼロ終了コードを返し、envelope の `errors[0].code` が `INVALID_REASON` となる。
- `node src/sdd-forge.js flow set issue-log --step draft --reason "20 文字以上の具体的な理由を記載する"` は成功し、`issue-log.json` にエントリが追加される。
- 任意フィールド `--trigger "短い"` のように 10 文字未満を指定すると `INVALID_FIELD` エラーになる。
- `npm test -- --test tests/unit/flow/set-issue-log.test.js` が全ケース PASS する。
- リポジトリ内の grep で、新閾値に反する reason/trigger/resolution/guardrail-candidate リテラルが残っていない。

## Migration Plan

- 実装と同一コミット内でテスト文言を新閾値準拠の文字列へ差し替える。
- エラー envelope の `messages` に「最小文字数を満たす具体的な reason を記述してください」というガイダンスを含め、利用者が違反内容を即把握できるようにする。
- sdd-forge は alpha 版であり、外部依存の存在しない CLI 仕様変更のため非推奨期間は設けない。

## Test Strategy

- P1/P2 は `tests/unit/flow/set-issue-log.test.js` に最小長違反ケースと境界値ケースを追加する。
- P3 は既存テストの reason 文字列を差し替えることで成立を検証する（差し替え後に全ケース PASS）。
- リポジトリ全体に対する grep チェックは手動 acceptance として扱い、自動テスト化はしない。

## Open Questions

- なし

## Impact on Existing Features

- `tests/unit/flow/set-issue-log.test.js`: 短文 reason を使う既存ケースを新閾値準拠に更新（破壊的変更に対応）。
- `run gate` post hook: 常に十分長い reason を生成するため挙動影響なし。
- SDD スキル（`flow-plan`, `flow-impl` 等）: 実行例示の短文を確認・必要に応じ更新。
- その他 `flow set` 系コマンド: 影響なし（本 spec はバリデーション波及を行わない）。
