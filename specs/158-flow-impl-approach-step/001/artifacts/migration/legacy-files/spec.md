# Feature Specification: 158-flow-impl-approach-step

**Feature Branch**: `feature/158-flow-impl-approach-step`
**Created**: 2026-04-08
**Status**: Draft
**Input**: Issue #114

## Goal

flow-impl の実装着手前に、spec の各要件ごとの設計方針をユーザーが確認・承認できるステップを追加する。アーキテクチャ上の問題（引数過多・既存コード未活用・不適切なデザインパターン等）がコーディング後に発覚することを防ぐ。

## Scope

- `src/templates/skills/sdd-forge.flow-impl/SKILL.md` への手順追記
- 方針提示フォーマットの定義（spec 要件ごとの「方針・使う既存コード・設計判断」）
- 承認/差し戻しループの定義（リトライ上限3回）
- autoApprove 時の自動承認ルールの定義

## Out of Scope

- `sdd-forge flow run approach` CLI コマンドの新設
- approach.md ファイルへの保存
- `approach-confirm` step ID の phases.js への追加

## Clarifications (Q&A)

- Q: 変更対象はどのレイヤー？
  - A: SKILL.md のみ。CLI コマンドは作らない。
- Q: 方針提示の内容はファイル名列挙でよいか？
  - A: No。spec の各要件ごとに「方針・使う既存コード・なぜその設計か」を提示する。ユーザーが引数過多や既存コード未活用を発見できる粒度が必要。
- Q: 承認/差し戻しはどう構造化するか？
  - A: SKILL.md の標準選択肢形式（`[1] 進める [2] 変更したい`）で実現。差し戻し後は修正指示を受けて再提示。

## Alternatives Considered

- CLI コマンド新設: ファイル保存・進捗記録が不要という判断により採用しない
- ファイル名列挙形式: ユーザーが設計判断を評価できないため不採用

## Requirements

1. flow-impl のステップ1（implement）冒頭で、コードを書く前に実装方針を提示すること
2. 提示フォーマット: spec の各要件ごとに、方針・使う既存コード・設計上の判断を記載すること
3. ユーザーが `[1] この方針で進める [2] 変更したい` で承認/差し戻しを選択できること
4. 差し戻し時は修正指示を受けて方針を更新し再提示すること。リトライ上限は3回とすること
5. autoApprove が true の場合は方針を提示した上で自動承認し、即座にコーディングへ進むこと
6. 承認後にコーディングを開始すること（承認前にコードを書いてはならない）

## Acceptance Criteria

- flow-impl を起動すると、ステップ1のコーディング開始前に実装方針が提示される
- 提示内容は spec の要件番号を参照し、各要件の実装方針・既存コードの活用有無・設計上の判断を含む
- ユーザーが `[2] 変更したい` を選択した場合、AI は修正指示を反映した方針を再提示する
- autoApprove: true の場合、方針提示後に自動承認して即座にコーディングへ進む
- 承認前にソースコードの変更が行われない

## Test Strategy

変更対象は `SKILL.md`（AI へのプロンプト文書）のみであり、自動テストは適用できない。

検証方法:
- flow-impl を実際に起動し、ステップ1でコーディング前に方針提示が行われることを手動確認する
- `[2] 変更したい` を選択した際に AI が修正方針を再提示することを確認する
- autoApprove モードで方針提示後に自動承認されコーディングへ進むことを確認する

## Open Questions

なし

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-08
- Notes:
