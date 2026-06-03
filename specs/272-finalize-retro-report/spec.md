# Feature Specification: 272-finalize-retro-report

**Feature Branch**: `feature/272-finalize-retro-report`
**Created**: 2026-06-03
**Status**: Draft
**Input**: GitHub Issue #351

## Goal
finalize 後に表示・保存される report の Retro セクションへ、既存の retro.json 集計結果を反映する。

## Background
Issue #351 は、finalize 後の report.json と report 表示で Retro セクションが '-' になり、生成済み retro.json の集計結果が表示されない不具合を対象にしている。retro.json は生成済みで summary と requirements を持つ。run-report 単体は retro.json を results.retro に戻して generateReport に渡すが、finalize post-hook の executeCommitPost は test artifacts だけを復元し、retro.json を report 入力に戻していない。そのため generateReport の Retro 条件を満たせず、data.retro が null になる。

## Impact on Existing Features

本変更は finalize-commit 後の report.json と report 表示に影響する。既存の flow run report 単体の挙動、retro.json 生成ロジック、GitHub issue comment 投稿、finalize cleanup の挙動は変更しない。finalize post-hook が RetroCommand を呼ばない責務分離も維持する。

## Scope
- must: finalize post-hook の report 生成入力に既存 retro.json を反映する。
- must: report.json の data.retro に retro.json summary と requirements が入ることを保証する。
- must: 人間向け report 表示の Retro セクションが '-' ではなく集計行を表示することを保証する。
- must: finalize 経由の回帰テストを追加する。

## Out of Scope
- RetroCommand を finalize post-hook から再実行する変更。
- retro.json の生成ロジック自体の変更。
- report 全体の表示形式の刷新。
- GitHub issue comment や finalize cleanup の挙動変更。

## Constraints
- 外部依存は追加しない。Node.js 組み込みモジュールのみを使う。
- Retro 実行は mainline impl-phase step の責務として維持し、finalize post-hook では再実行しない。
- flow run report 単体の既存挙動を維持する。
- CLI コマンド、user-facing 引数、exit code contract は追加・変更しない。

## Design Principles
- run-report と finalize post-hook の report 入力構築を同じ retro.json 形状に揃える。
- finalize post-hook は既存 artifact を report 入力に戻すだけに留め、retro artifact 生成責務を持たせない。

## Overview
### Modules
- src/flow/lib/run-finalize.js — executeCommitPost が report 生成前に spec ディレクトリの retro.json を読み、results.retro を補完する。
- src/flow/lib/run-report.js — 既存の retro.json 読み込み形状を finalize 側の参照基準にする。
- src/flow/commands/report.js — results.retro.status と summary から data.retro と report text を作る既存 renderer。
- specs/272-finalize-retro-report/tests/ — finalize 経由 report が retro.json summary を保存・表示することを検証する spec-local test。

### Data Flow
- retro step が specs/<id>/retro.json を生成する。
- finalize post-hook の executeCommitPost が retro.json を読み、results.retro = { status: "done", summary, requirements } を構築する。
- generateReport が results.retro から data.retro を作り、saveReport が specs/<id>/report.json に保存する。
- formatReportText が data.retro を Retro セクションの集計行として表示する。

### Decisions
- [VERIFY] run-report の retro.json 入力形状を finalize 側でも使う。結果=match。
- [VERIFY] generateReport は results.retro が done かつ summary ありの場合だけ report data の retro を作る。結果=match。
- [VERIFY] finalize post-hook は現状 test artifacts だけを復元し、retro.json は読まない。結果=match。
- RetroCommand を finalize から呼ばない既存責務分離は維持する。

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
- finalize post-hook から RetroCommand を再実行する — 却下。Retro 実行は mainline impl-phase step の責務であり、finalize は既存 artifact を report 入力へ復元するだけで足りる。
- generateReport が retro.json を直接読む — 却下。generateReport は structured input から report data/text を作る関数であり、filesystem access を持たせると責務が広がる。
- finalize report の Retro 表示を '-' のまま許容する — 却下。retro.json が存在し summary がある場合に report が結果を表示しないため、Issue #351 の不具合を解消できない。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-06-03T02:55:28.417Z
- Notes: autoApprove: spec-gate PASS; spec-review provider schema failure manually accepted per user instruction

## Requirements
- R1 [must]: src/flow/lib/run-finalize.js の executeCommitPost は、spec ファイルが存在する場合に report 生成前へ spec ディレクトリの retro.json 読み込みを追加する。retro.json が存在する場合、results.retro に { status: "done", summary: retro.summary, requirements: retro.requirements } を設定する。
- R2 [must]: retro.json が存在しない finalize flow では results.retro を生成せず、既存の「finalize post-hook は RetroCommand を呼ばない」挙動を維持する。
- R3 [must]: finalize 経由で保存される report.json は、retro.json の summary を data.retro に含め、retro.json の requirements がある場合は data.retro.requirements に含める。
- R4 [must]: finalize 経由で生成される人間向け report text の Retro セクションは、retro.json summary の rate/done/partial/not_done から集計行を表示し、retro.json が存在するケースで '-' だけを表示しない。

## Acceptance Criteria
- R1: executeCommitPost が spec ディレクトリの retro.json を読み、generateReport に渡る results.retro を done + summary + requirements の形で構築する。
- R2: 既存の run-finalize retro invocation test は PASS し、run-finalize.js は RetroCommand / RunRetroCommand を参照しない。
- R3: spec-local test で executeCommitPost 実行後の report.json data.retro.done / partial / not_done / rate / requirements が retro.json の値と一致する。
- R4: spec-local test で executeCommitPost 実行後の report text が Retro 集計行を含み、Retro セクションが '-' のみではないことを検証する。
- 既存 unit scope test が PASS する。

## Implementation Targets
-

## Open Questions
- [ ]

## Tasks
### Round 0
- **T-1** [pending]: Restore retro input in finalize report
  - executeCommitPost が既存 retro.json を report 入力へ戻し、finalize report に Retro 集計を表示できるようにする。
  - see `tasks/T-1.md` for full spec
- **T-2** [pending]: Add finalize retro report regression test
  - finalize 経由の report.json と report text が retro.json summary を表示することを spec-local test で固定する。
  - see `tasks/T-2.md` for full spec
