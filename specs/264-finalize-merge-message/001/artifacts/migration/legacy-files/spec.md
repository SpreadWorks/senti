# Feature Specification: 264-finalize-merge-message

**Feature Branch**: `feature/264-finalize-merge-message`
**Created**: 2026-05-20
**Status**: Draft
**Input**: GitHub Issue #339

## Goal
finalize-merge の squash commit message を spec goal ベースの人が読める変更要約にする

## Background
Issue #339 points out that finalize-merge の squash commit message は spec directory slug 由来になりやすく、main branch の履歴で変更内容を読み取りにくい。現在の merge.js は PR route では spec goal を title に使う一方、squash route では state.spec path から作った subject を使っている。squash route でも spec goal を既定 subject に使えば、履歴上の commit subject が spec の目的文に揃う。

## Scope
- src/flow/commands/merge.js の squash merge route で使う既定 commit message
- spec goal が空の場合の commit subject fallback
- Issue が紐づく場合の squash commit footer
- squash commit message 生成の spec-local test と既存 unit test

## Out of Scope
- PR route の PR title/body 生成結果の変更
- merge strategy selection の変更
- finalize-commit の feature branch commit message 仕様変更
- ユーザー指定の custom commit message を上書きする変更

## Constraints
- 外部依存を追加しない。Node.js 組み込みモジュールと既存 helper の範囲で実装する。
- 既存 CLI command / option の意味を変更しない。backward-compatible-cli-interface を維持する。
- Issue が紐づく場合は既存の `fixes #<issue>` footer を維持する。
- slug は spec goal と実装 commit 要約がどちらも得られない場合の最終 fallback に限定する。

## Design Principles
-

## Overview
### Modules
- src/flow/commands/merge.js — squash merge route の commit message 生成責務を持つ。既存 PR title/body helper と同じ spec goal 情報を commit subject に使う。
- tests/unit/flow/commands/merge.test.js — spec goal / fallback / Issue footer の commit message 生成 contract を unit test で検証する。
- src/flow/registry.js / src/flow/lib/run-finalize.js — finalize metadata/report commit subject の既知パターンを fallback filtering の対象として扱う。
- specs/264-finalize-merge-message/tests/ — R1-R3 の spec-local coverage を置き、test-execute の対象にする。

### Data Flow
- flowState.spec から spec.json を読み、parseSpec の goal を commit subject の第一候補にする。goal が空なら baseBranch..featureBranch の commit subjects を新しい順に最大 50 commit 読み、finalize metadata/report subject を除外した最初の subject を使う。
- commit body は Issue がある場合に既存 footer を維持し、subject の可読性改善と Issue close 連携を分離する。

### Decisions
- [VERIFY] draft policy: PR route already reads spec goal, squash route uses slug-like spec path; result=match.
- [VERIFY] Issue footer policy remains in scope; result=match.
- spec goal is the first subject source because it is the approved user-facing purpose and is already used for PR title generation.
- PR title/body output and merge strategy selection stay unchanged.
- implementation commit fallback filters finalize-generated subjects before choosing a subject.

## Clarifications (Q&A)
- Q: spec title とは何を指すか。
  - A: この codebase の spec.json に title field はないため、既存 PR title と同じく spec goal の先頭の非空行を subject source として扱う。
- Q: human-readable をどう検証するか。
  - A: 主観評価ではなく、subject が spec directory slug だけではなく spec goal または実装 commit subject 要約由来であることを検証する。
- Q: 実装 commit subject 要約はどの commit から取るか。
  - A: `baseBranch..featureBranch` の commit subjects を新しい順に最大 50 commit 見て、finalize が生成する metadata/report subject を除外した最初の subject を使う。

## Alternatives Considered
- 実装 commit subject 要約を第一候補にする — 実装中の修正 commit やレビュー対応 commit の粒度に左右されるため不採用。承認済み spec goal を第一候補にする。
- Issue footer を `refs #<issue>` に変える — 既存の GitHub Issue close 連携を弱めるため不採用。Issue #339 は footer 変更ではなく subject 可読性を求めている。
- PR title/body 生成も同時に変更する — PR route は既に spec goal / requirements / scope を使う。今回の scope は squash commit message に限定する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-05-20T08:07:38.975Z
- Notes: autoApprove: spec gate passed and user selected auto mode for #339

## Requirements
- R1 [must]: squash merge route の既定 commit subject は、spec.json の goal の先頭の非空行を第一候補にする。goal が存在する場合、subject は spec directory slug だけの文字列にならない。
- R2 [must]: spec goal が空または読み込めない場合、既定 commit subject は `baseBranch..featureBranch` の commit subjects を新しい順に最大 50 commit 読み、finalize 生成 commit を除外した最初の subject を使う。除外対象は `chore: record finalize metadata before merge` と `chore: add retro and report` を含む既知の finalize metadata/report subject とする。除外後の subject が得られない場合のみ、従来の slug fallback を使う。
- R3 [must]: Issue が紐づく squash commit は既存の `fixes #<issue>` footer を維持する。PR title/body 生成結果、merge strategy selection、custom commit message 指定の意味は変更しない。

## Acceptance Criteria
- spec goal がある finalize-merge squash route では、作成される squash commit subject が spec goal の先頭の非空行になる。
- spec goal が空の finalize-merge squash route では、finalize metadata/report commit subject を除外した最新の feature branch commit subject が squash commit subject になる。
- spec goal が読み込めない finalize-merge squash route でも、finalize metadata/report commit subject を除外した実装 commit subject fallback が使われる。
- spec goal と、finalize 生成 commit を除外した実装 commit subject がどちらも得られない場合だけ slug fallback になる。
- Issue がある squash commit は body に `fixes #<issue>` footer を含む。
- PR route の buildPrTitle / buildPrBody の既存 unit test が引き続き通る。
- 新しい spec-local test が R1-R3 を header 付きで検証する。

## Implementation Targets
- src/flow/commands/merge.js
- src/flow/registry.js
- src/flow/lib/run-finalize.js
- tests/unit/flow/commands/merge.test.js
- specs/264-finalize-merge-message/tests/

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Build squash commit message from spec goal
  - squash merge route の既定 commit subject を spec goal 優先にし、goal が使えない場合の fallback を定義どおりに適用する。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Preserve issue footer and route contracts
  - Issue 連携 footer と PR/custom/strategy の既存契約を維持したまま、squash commit subject だけを変更対象にする。
  - see `tasks/T-2.md` for full spec
