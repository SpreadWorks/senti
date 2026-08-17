# Feature Specification: 125-add-test-txt

**Feature Branch**: `feature/125-add-test-txt`
**Created**: 2026-04-02
**Status**: Draft
**Input**: User request

## Goal
プロジェクトルートに `test.txt` を作成する。finalize パイプライン（spec #124 の修正）の動作検証が主目的。

## Scope
- ルートに `test.txt` を作成する

## Out of Scope
- なし

## Clarifications (Q&A)
- Q: test.txt の内容は？
  - A: "test" とだけ書く

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: autoApprove — finalize 検証用ダミータスク

## Requirements

R1 [P1]: 実装時にプロジェクトルートに `test.txt` を作成する。内容は "test" のみ。finalize 後にメインリポジトリに存在すること。

## Acceptance Criteria

AC1: finalize 完了後、メインリポジトリのルートに `test.txt` が存在する。

## Open Questions
(none)
