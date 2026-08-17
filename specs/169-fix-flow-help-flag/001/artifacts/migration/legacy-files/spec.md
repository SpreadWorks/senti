# Feature Specification: 169-fix-flow-help-flag

**Feature Branch**: `feature/169-fix-flow-help-flag`
**Created**: 2026-04-13
**Status**: Draft
**Input**: GitHub Issue #135

## Goal

flow サブコマンドの positional-only 経路で `-h`/`--help` が通常の位置引数として解釈されるバグを修正し、全サブコマンドで一貫して help を表示できるようにする。

## Scope

- `src/flow.js` の `parseEntryArgs` 関数内、positional-only 経路（flags/options を持たない args 定義）に `-h`/`--help` の検出処理を追加する
- 影響を受ける positional-only コマンド 11 件すべてで help が正しく動作することを検証する

## Out of Scope

- help テキストの内容変更
- flags/options を持つコマンドや args なしコマンドの help 処理（既に動作している）
- registry.js の構造変更

## Clarifications (Q&A)

- Q: 修正箇所は parseEntryArgs の 1 箇所で全 11 コマンドをカバーできるか？
  - A: はい。positional-only 経路は `parseEntryArgs` 内の 1 つの分岐のみ。ここに help チェックを追加すれば、positional のみの args 定義を持つ全コマンドに適用される。
- Q: help フラグが positional 引数の前後どちらにあっても動作すべきか？
  - A: はい。`rawArgs` 配列内のどの位置に `-h`/`--help` があっても検出する。

## Alternatives Considered

- 各コマンドの registry 定義に個別に flags: ["-h", "--help"] を追加する案 → positional-only 経路の共通処理で対応する方が DRY であり、将来追加されるコマンドにも自動適用されるため却下。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-13
- Notes: Gate PASS 後に承認

## Requirements

1. [P1] `parseEntryArgs` の positional-only 経路で、`rawArgs` に `-h` または `--help` が含まれる場合、`ctx.help = true` を設定してリターンすること
2. [P1] 既存の positional 引数パース（`flow get check dirty`, `flow set step gate done` 等）の動作が変わらないこと
3. [P1] positional-only コマンド 11 件で `--help` 実行時に exit code 0 で help テキストが出力されること

## Acceptance Criteria

- `node src/sdd-forge.js flow get check --help` が exit 0 で usage を出力する
- `node src/sdd-forge.js flow set step --help` が exit 0 で usage を出力する
- `node src/sdd-forge.js flow get check dirty` が従来どおり動作する（regression なし）

## Test Strategy

- CLI 実行（e2e 的）で検証する
- positional-only コマンドの代表（`get check`, `set step`, `get prompt` 等）で `--help` が exit 0 + help テキスト出力になることを確認
- 既存の正常引数パース（`get check dirty` 等）が壊れないことを確認
- テスト配置: `specs/169-fix-flow-help-flag/tests/`（spec 検証テスト）

## Open Questions

（なし）
