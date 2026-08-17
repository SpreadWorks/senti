# Feature Specification: 227-post-226-forest-integration

**Feature Branch**: `feature/227-post-226-forest-integration`
**Created**: 2026-04-24
**Status**: Draft
**Input**: GitHub Issue #257

## Goal

spec 226 で scaffolding のみ実装した forest task decomposition を完全統合する。既存 flow state の migration、strict 化、overview/forest 自動配線、E2E test を通じて、task decomposition がプロダクション品質で動作する状態にする。

## Background

spec 226 は forest 配線の基盤（guardrail、prompt 強化、schema 強化、sync-spec-tasks、completeTask、手動復旧 CLI、update-overview CLI）を scaffolding として実装した。しかし以下が未完了:

- 263 件の既存 flow state が tasks[] 空のまま残存
- flow state loader が tasks[] 空を許容しており strict 化されていない
- next-action resolver に tasks[] 空時の互換 fallback が残存
- overview merge が impl step の完了後に自動実行されない
- resolveTarget が forest 構造を直接参照していない
- placeholder tests（it.todo 64 件）が実テスト化されていない
- E2E integration test がない

## Scope

- 既存 flow state の migration（263 件 → tasks[] 非空）
- flow state loader の strict 化（tasks[] 空で reject）
- next-action resolver の互換 fallback 廃止
- reopen-draft 関連の旧テスト削除
- impl step 完了時の overview merge 自動実行
- resolveTarget での forest 構造直接参照
- spec 226 の placeholder tests（64 件）の実テスト展開
- E2E integration test 新規追加
- 本 spec 自体の forest dogfood（タスクを forest 構造で分解）

## Out of Scope

- reopen-draft コマンド本体の削除（テスト削除のみ）
- 旧 spec の機能改修
- guardrail / prompt テンプレートの変更

## Constraints

- migration は dry-run + idempotent であること
- migration → strict 化 → fallback 廃止の順序を守ること（逆順だと既存 flow state が読めなくなる）
- forest depth は spec 226 で定めた上限 10 を超えないこと
- テスト基盤（setupFlow ヘルパー）を tasks 非空に対応させること

## Design Principles

- spec 208 パターン（one-time migration script）を踏襲
- 既存の promoteNextPending / completeTask 機構を活用（新規機構の追加を最小化）
- E2E test は CLI 経由一本で駆動し、flow state の直接編集を行わない

## Overview

### Modules

- `src/lib/flow-store.js` — tasks[] 空 reject を追加
- `src/flow/lib/get-next-action.js` — flat fallback 削除 + resolveTarget に forest 参照追加
- `src/flow/registry.js` — impl step 完了の post-hook に overview merge を追加
- `specs/227-*/migrate.js` — one-time migration script
- `tests/helpers/flow-setup.js` — setupFlow の tasks 非空保証
- `tests/unit/226-task-decomp-wiring/*.test.js` — placeholder tests 展開（6 ファイル）
- `tests/e2e/` — 新規 E2E integration test

### Data Flow

1. migration script が既存 flow.json を走査し、tasks[] を合成して書き戻す
2. flow-store.js の load が tasks[] 空を reject（migration 後は全件非空のため安全）
3. get-next-action の resolveTarget が forest 構造を直接参照し task 順序を決定
4. impl step 完了時に registry.js の post-hook が update-overview CLI を呼び出し

### Decisions

- migration は spec.json からの逆引きではなく、flow state の steps から合成 task を生成する（spec.json に tasks 定義がない旧 spec が大半のため）
- reopen-draft コマンド本体は残す（テストのみ削除）。コマンド自体の廃止は別 issue で判断

## Clarifications (Q&A)

- Q: Issue 記載の "scenario-reopen-flow.test.js" は存在しないが削除対象は？
  - A: コード探索の結果 `tests/unit/flow/run-reopen-draft.test.js` が該当。Issue のファイル名は誤り。
- Q: Migration で spec.json の tasks を使うか？
  - A: 使わない。旧 spec の大半は spec.json に tasks 定義がないため、flow state の steps から 1 つの合成 task を生成する。
- Q: テスト基盤の対応は？
  - A: setupFlow ヘルパーを修正し、デフォルトで tasks 非空の flow state を生成する。既存テストの fixture 破損を防ぐ。

## Alternatives Considered

- **concern ごとに別 spec に分ける**: 却下。A〜D は forest 配線の完全統合という単一テーマに収まり、D（dogfood）は spec 自体の構造で実現するため分離不能。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-24
- Notes:

## Requirements

### P1: A. 既存資産の migration と strict 化

- REQ-A1: migration を実行したとき、全既存 flow state が tasks 非空状態に変換されること（dry-run + idempotent）
- REQ-A2: flow state の読み込み時に tasks が空の場合、エラーとして拒否されること
- REQ-A3: next-action 解決が tasks 非空を前提とし、tasks 空時の互換経路が存在しないこと
- REQ-A4: production path を経由しない旧テスト（reopen-draft 関連）が削除されること

### P2: B. scaffolding の完全統合

- REQ-B1: impl step が完了したとき、overview merge が自動実行されること
- REQ-B2: next-action が target を解決するとき、forest 構造に基づいて task 順序を決定すること
- REQ-B3: spec 226 の placeholder tests を実テストに展開したとき、全件が PASS すること

### P3: C. E2E integration test

- REQ-C1: tasks 2 件の flow を CLI 経由のみで開始したとき、flow state の直接編集なしで全 step が遷移し完了すること

### P4: D. Forest dogfood

- REQ-D1: 本 spec のタスク構造が forest 形式（親 task = concern 境界、子 task = 作業単位）で分解されていること

## Acceptance Criteria

- AC-1: `node specs/227-*/migrate.js` を実行すると全 263 件の flow.json が tasks 非空になる。再実行しても結果が変わらない（idempotent）
- AC-2: `npm test` が全件 PASS（strict 化後も既存テストが破損しない）
- AC-3: spec 226 の it.todo 64 件が全て実テストに展開され PASS
- AC-4: E2E test が flow.json 直接編集なしで全 step 遷移を完了
- AC-5: spec.json の tasks[] が forest 構造（parent/child 関係あり）で定義されている

## Implementation Targets

- `src/lib/flow-store.js`
- `src/flow/lib/get-next-action.js`
- `src/flow/registry.js`
- `src/lib/flow-helpers.js`
- `specs/227-post-226-forest-integration/migrate.js` (new)
- `tests/helpers/flow-setup.js`
- `tests/unit/flow/run-reopen-draft.test.js` (delete)
- `tests/unit/226-task-decomp-wiring/t1-entry-enforcement.test.js`
- `tests/unit/226-task-decomp-wiring/t2-schema-structured.test.js`
- `tests/unit/226-task-decomp-wiring/t3-spec-render-tasks-md.test.js`
- `tests/unit/226-task-decomp-wiring/t4-forest-wiring.test.js`
- `tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js`
- `tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js`
- `tests/e2e/227-forest-e2e.test.js` (new)

## Open Questions
- (none)
