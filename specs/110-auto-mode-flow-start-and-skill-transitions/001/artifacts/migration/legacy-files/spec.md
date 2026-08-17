# Feature Specification: 110-auto-mode-flow-start-and-skill-transitions

**Feature Branch**: `feature/110-auto-mode-flow-start-and-skill-transitions`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Issue #44

## Goal

auto mode（autoApprove）で flow-auto-on skill をゲートキーパー化し、各 skill 完了時に次の skill へ自動遷移するようにする。これにより `/sdd-forge.flow-auto-on` 一発で plan → impl → finalize まで自走できるようになる。

## Scope

- `src/templates/skills/sdd-forge.flow-auto-on/SKILL.md` — ゲートキーパー化（flow.json 確認 + request/issue 確認 → auto ON → 適切な skill 誘導）
- `src/templates/skills/sdd-forge.flow-plan/SKILL.md` — 最終ステップで autoApprove なら `/sdd-forge.flow-impl` を Skill tool で呼ぶ指示を追加
- `src/templates/skills/sdd-forge.flow-impl/SKILL.md` — 最終ステップで autoApprove なら `/sdd-forge.flow-finalize` を Skill tool で呼ぶ指示を追加

## Out of Scope

- コード変更（`src/lib/`, `src/flow/` 等のプロダクトコード）
- flow-auto-on から直接 prepare-spec を実行する機能（最初から auto は flow-plan 経由で対応）
- flow-auto-off skill の変更

## Clarifications (Q&A)

- Q: flow.json 未存在時に flow-auto-on はどうするか？
  - A: 「フローが開始されていません。`/sdd-forge.flow-plan` でフローを開始してください」とガイドして STOP する。

- Q: request も issue もない状態で auto ON しようとした場合は？
  - A: 「要件が設定されていません。Issue リンクまたは request を設定してください」とガイドして STOP する。flow-auto-on がゲートキーパーとして機能する。

- Q: 最初から auto で始めたい場合は？
  - A: ユーザーが flow-plan を呼ぶ際に「auto で」と言えば、AI が prepare-spec 後に `flow set auto on` を実行する。flow-auto-on skill を経由しない。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-31
- Notes: Gate PASS 後に承認

## Requirements

1. (P1) `flow-auto-on/SKILL.md` を修正する。手順: (a) `flow get status` を実行 → コマンドエラーまたは `ok: false` なら「フローが開始されていません」とエラーメッセージを表示して STOP、(b) status の `request` と `issue` を確認 → 両方 null なら「要件が設定されていません」とガイドして STOP、(c) `flow set auto on` を実行 → 失敗（`ok: false` またはコマンド実行エラー）ならエラー内容をユーザーに表示して STOP。手順全体を通じて、コマンド失敗時はエラー内容を表示して STOP する（エラーを握りつぶさない）、(d) 現在の phase/steps に基づいて適切な flow skill を Skill tool で呼ぶ。対応: plan フェーズの未完了ステップがある場合 → `/sdd-forge.flow-plan`、plan 完了かつ impl フェーズの未完了ステップがある場合 → `/sdd-forge.flow-impl`、impl 完了かつ finalize フェーズの未完了ステップがある場合 → `/sdd-forge.flow-finalize`、全ステップ完了 → 「全ステップ完了済み」と表示して STOP
2. (P1) `flow-plan/SKILL.md` の最終ステップ（step 8 完了後の plan.complete 選択肢処理）に追記する。内容: 「autoApprove: true の場合、[1] が選ばれたものとして `/sdd-forge.flow-impl` を Skill tool で呼べ」
3. (P1) `flow-impl/SKILL.md` の最終ステップ（step 3 の impl.confirmation 選択肢処理）に追記する。内容: 「autoApprove: true の場合、[1] が選ばれたものとして `/sdd-forge.flow-finalize` を Skill tool で呼べ」

## Acceptance Criteria

- flow-auto-on skill が flow.json 未存在時にガイドメッセージを表示して停止する
- flow-auto-on skill が request も issue もない場合にガイドメッセージを表示して停止する
- flow-auto-on skill が条件を満たした場合に auto ON + 適切な skill を呼ぶ
- flow-plan の SKILL.md に autoApprove 時の flow-impl 自動呼び出し指示が記述されている
- flow-impl の SKILL.md に autoApprove 時の flow-finalize 自動呼び出し指示が記述されている
- 既存テストがパスする

## Open Questions

- なし
