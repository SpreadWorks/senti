# Feature Specification: 126-add-text-txt-verify

**Feature Branch**: `feature/126-add-text-txt-verify`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User request

## Goal
プロジェクトルートに `text.txt` を作成する。finalize パイプライン修正（2回目 squash マージ、report メインリポジトリ保存）の動作検証が目的。

## Scope
- ルートに `text.txt` を作成する

## Out of Scope
- なし

## Clarifications (Q&A)
- Q: text.txt の内容は？
  - A: "text" とだけ書く

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: autoApprove — finalize 検証用

## Requirements

R1 [P1]: 実装時にプロジェクトルートに `text.txt` を作成する。内容は "text" のみ。finalize 後にメインリポジトリに存在すること。

## Acceptance Criteria

AC1: finalize 完了後、メインリポジトリのルートに `text.txt` が存在する。
AC2: finalize の cleanup が成功する（worktree 内に untracked files が残らない）。
AC3: `specs/126-add-text-txt-verify/report.json` がメインリポジトリに存在する。
AC4: `specs/126-add-text-txt-verify/retro.json` がメインリポジトリに存在する。

## Open Questions
(none)
