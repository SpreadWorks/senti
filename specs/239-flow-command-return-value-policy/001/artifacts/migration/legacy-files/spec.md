# Feature Specification: 239-flow-command-return-value-policy

**Feature Branch**: `feature/239-flow-command-return-value-policy`
**Created**: 2026-04-28
**Status**: Draft
**Input**: GitHub Issue #282

## Goal
flow get/set/run コマンドの返却値を「状態クエリ系」と「操作系」に分類し、前提条件不足時の挙動を統一する。

## Background
flow get/set/run コマンドで前提条件不足時の挙動が3パターン混在している:
- (A) ok:true + 状態値 (get-status のみ)
- (B) throw Error (base-command guard + コマンド内)
- (C) Envelope.fail return

throw と Envelope.fail は dispatcher の catch-all で最終的に同じ JSON envelope になるが、post-hook スキップの挙動が異なる (Envelope.fail return は skipPost=true、throw は onError hook を呼ぶ)。

#187 の draft レビューで「エラーなのか状態返却なのか判断がブレている」と指摘された。

## Scope
- [must] 全 flow get/set/run コマンドの分類（状態クエリ vs 操作）と方針の docs 明文化
- [must] 状態クエリ系コマンドの requiresFlow:false 化と空状態返却の実装
- [should] 操作系コマンド内のユーザー起因エラーの throw → Envelope.fail 統一
- [nice-to-have] 内部エラー（agent 呼び出し失敗等）のエラーコード付与

## Out of Scope
- dispatcher.js の throw→Envelope.fail ラップ機構の変更
- Envelope クラス自体の変更
- registry.js のフック構造の変更
- base-command.js の requiresFlow guard の削除

## Constraints
- alpha 版ポリシーにより後方互換コードは書かない
- Node.js 組み込みモジュールのみ使用
- 既存の dispatcher.js の catch-all ラップは安全弁として残す

## Design Principles
- 状態クエリ系コマンドは副作用を持たず、flow 不在時でも ok:true + 空状態を返す
- 操作系コマンドはユーザー起因の前提条件違反を Envelope.fail で返し、内部エラーは throw のまま
- get-status の { active: false } パターンを状態クエリ系の標準とする

## Overview
### Modules
| Module | Role |
|---|---|
| flow/lib/get-*.js | 状態クエリ系 get コマンド群。requiresFlow と空状態返却を統一 |
| flow/lib/set-*.js | 操作系 set コマンド群。throw → Envelope.fail 統一 |
| flow/lib/run-*.js | 操作系 run コマンド群。ユーザー起因エラーの throw → Envelope.fail 統一 |
| src/CLAUDE.md | 返却値方針の明文化 |

### Data Flow
消費者 (AI スキル) → `sdd-forge flow get <key>` → `Envelope.ok({ active: false, ... })` or `Envelope.ok({ step, action, ... })`

### Decisions
- **D1**: 分類基準 — コマンドの目的が「現在の状態を読み取る」か「状態を変更する/副作用を起こす」か。get-status が既に正しいパターンを実装済み。
- **D2**: 操作系の前提条件違反は Envelope.fail を返す（throw ではない）。dispatcher.js:229 の skipPost=true が正しい挙動。内部エラーは throw のまま。
- **D3**: alpha 版ポリシーにより後方互換コードは書かない。exit code 変化は直接変更。

## Clarifications (Q&A)
- Q: base-command.js の requiresFlow guard と dispatcher.js の guard が二重化している
  - A: スコープ外。base-command.js の guard はテストで直接インスタンス化時の安全弁として残す

## Alternatives Considered
- **全 throw を Envelope.fail に統一**: 内部エラーまで code 付与は過剰。dispatcher の catch-all で十分
- **ok:false + NOT_ACTIVE code で統一**: Issue の方針に反する。状態クエリは ok:true であるべき
- **deprecated 警告で段階移行**: alpha 版ポリシーに反する

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-28
- Notes: autoApprove

## Requirements

| ID | Priority | Requirement |
|---|---|---|
| R1 | must | get-next-action: flow 不在時に ok:true + { step: null, action: null } を返す |
| R2 | must | get-next-action: 全ステップ完了時に ok:true + { step: null, action: 'completed' } を返す |
| R3 | must | get-check: requiresFlow:false に変更。flow 不在時の step prerequisites は { pass: false, summary: 'no active flow' } を返す |
| R4 | must | src/CLAUDE.md に返却値方針セクションを追加 |
| R5 | should | run-reopen-draft: ユーザー起因 throw を Envelope.fail に統一 |
| R6 | should | set-issue-log: 混在 throw を Envelope.fail に統一 |
| R7 | should | run-retro: ユーザー起因 throw を Envelope.fail に統一 |

## Acceptance Criteria
- flow 不在時に `sdd-forge flow get next-action` が exit code 0 + ok:true + data.step=null を出力する
- 全ステップ完了時に `sdd-forge flow get next-action` が exit code 0 + ok:true + data.action='completed' を出力する
- flow 不在時に `sdd-forge flow get check dirty` が正常に dirty チェックを実行する
- flow 不在時に `sdd-forge flow get check impl` が ok:true + pass:false + summary:'no active flow' を返す
- src/CLAUDE.md に返却値方針セクションが追加されている
- run-reopen-draft, set-issue-log, run-retro でユーザー起因エラーが Envelope.fail で返る
- 既存テストが全て PASS する

## Implementation Targets
- `src/flow/lib/get-next-action.js`
- `src/flow/lib/get-check.js`
- `src/flow/lib/run-reopen-draft.js`
- `src/flow/lib/set-issue-log.js`
- `src/flow/lib/run-retro.js`
- `src/CLAUDE.md`

## Impact on Existing Features
- **AI スキル (flow skill)**: get next-action を flow 不在時に throw ではなく ok:true + 空状態で受け取る。スキル側は ok フィールドで分岐しており exit code は参照していないため影響なし
- **exit code 変化**: get-next-action の flow 不在時 exit code が 1→0 に変わる。alpha 版ポリシーにより移行計画は不要。消費者は sdd-forge 自身の AI スキルのみ
- **既存テスト**: throw を期待しているテストは Envelope.fail return または ok:true 返却に変更が必要
- **post-hook 挙動**: 操作系コマンドで throw → Envelope.fail により onError hook route ではなく skipPost route が走る。registry.js の onError フィールドを持つコマンドを確認し、前提条件違反時の onError が必要な場合はその箇所を除外する

## Open Questions
None.

## Tasks

| ID | Title | Status |
|---|---|---|
| T-1 | 状態クエリ系 get コマンドの空状態返却 | pending |
| T-2 | 操作系コマンドの throw → Envelope.fail 統一 | pending |
| T-3 | 返却値方針の docs 明文化 | pending |
