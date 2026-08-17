# Feature Specification: 163-prevent-bg-cmd-in-flow

**Feature Branch**: `feature/163-prevent-bg-cmd-in-flow`
**Created**: 2026-04-09
**Status**: Draft
**Input**: Issue #121

## Goal

`sdd-forge` コマンドがバックグラウンドに移行した場合でも、完了するまで次フェーズに進まないことを AI に義務付ける。

## Scope

- `src/templates/partials/core-principle.md` への MUST ルール追記
- `sdd-forge upgrade` によるプロジェクトへの反映

## Out of Scope

- プロダクトコード（`src/flow/`, `src/lib/` 等）の変更
- エージェントタイムアウト値の変更
- バックグラウンド移行そのものを防ぐ仕組みの実装

## Clarifications (Q&A)

- Q: タイムアウト値の調整は対策になるか？
  - A: タイムアウトは問題の本質ではない。バックグラウンドに移行した場合も「完了まで待機」が正しい要件。
- Q: 対象コマンドを個別に列挙するか？
  - A: サブコマンドではなく `sdd-forge` コマンド全体を対象とする。列挙は漏れの原因になる。
- Q: 変更箇所はどこか？
  - A: `core-principle.md` partial は flow-plan / flow-impl / flow-finalize の各 SKILL.md から include されており、1箇所の追記で全スキルに反映される。

## Alternatives Considered

- **特定サブコマンドへの個別記述**: flow-finalize SKILL.md には類似の記述が既にあるが、他スキルに漏れがある。partial への追記で一元管理する方が保守性が高い。
- **バックグラウンド移行の防止（timeout 調整）**: ユーザー確認の結果、根本解決ではなく「移行しても待つ」の方針に決定。

## Why This Approach

`core-principle.md` は全フローの共通ルールを定義する partial であり、既に「NEVER chain or background」の禁止規定がある。同じ場所に「もし移行しても待機する」ルールを追記することで：
1. ルールの一貫性が保たれる
2. 新規スキル追加時も自動的に適用される
3. 変更量が最小（1ファイル1箇所）

## Requirements

優先順位: 1 → 2 → 3 → 4（順に依存関係あり）

1. **[最高]** `core-principle.md` の「NEVER chain or background」ルールの直後に、バックグラウンド移行時の待機義務を MUST で追記すること
2. **[高]** 追記するルールは `sdd-forge` コマンド全体を対象とすること（特定サブコマンドに限定しない）
3. **[高]** 「完了通知を受け取るまで次フェーズに進んではならない」という待機義務を明示すること
4. **[中]** SKILL.md テンプレートソース（`src/templates/skills/` および `src/templates/partials/`）の変更が diff に含まれること。`sdd-forge upgrade` は実装工程で実行する（`.claude/` は gitignore 対象のため diff には現れない）

## Acceptance Criteria

- `src/templates/partials/core-principle.md` に MUST ルールが追記されている
- 追記されたルールは「sdd-forge コマンドがバックグラウンドに移行した場合、完了通知を受け取るまで次フェーズに進んではならない」という趣旨を含む
- `src/templates/partials/core-principle.md` と `src/templates/skills/sdd-forge.flow-finalize/SKILL.md` の両方が diff に含まれている

## Test Strategy

このスペックはテンプレートファイルのテキスト変更のみ。プロダクションコードの変更はない。

- **スペック検証テスト** (`specs/163-prevent-bg-cmd-in-flow/tests/`): `core-principle.md` に待機義務の MUST ルールが含まれることを確認する grep ベースのテストを作成する
- **確認観点**: `core-principle.md` のテキストに「バックグラウンド」かつ「待機」（または英語相当語）のキーワードが含まれること
- `tests/` への追加は不要（SKILL.md 内容の維持を保証する長期テストではないため）

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-09
- Notes: core-principle.md に MUST ルール追記、sdd-forge upgrade で反映

## Open Questions

なし
