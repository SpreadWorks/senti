## Problem

`run-prepare-spec.js` creates a `T-pending-spec` placeholder task (steps: []) when initializing flow.json. After approval, when `syncSpecTasksToFlow` → `promoteNextPending` runs, this placeholder gets promoted to `currentTaskId`, causing subsequent flow-level step write operations (e.g., `updateStepStatus`) to fail with an `unknown step` error.

## Root Cause

A design decision to represent "no tasks yet" with a placeholder rather than an empty array. This was introduced because the schema validation in flow-store.js required tasks to be non-empty, but `promoteNextPending` cannot distinguish the placeholder from a real task.

## Fix

1. Relax the `load()` schema validation in flow-store.js to allow `tasks: []`
2. Remove `T-pending-spec` from run-prepare-spec.js and initialize with `tasks: []`
3. Remove related code such as `stripPendingSpecTask` in run-gate.js

## Affected Files

- src/lib/flow-store.js (schema validation)
- src/flow/lib/run-prepare-spec.js (initialization)
- src/flow/lib/run-gate.js (stripPendingSpecTask)

<details>
<summary>ja</summary>

[BUG] T-pending-spec プレースホルダーを廃止し tasks 空配列を許可する

## 問題

`run-prepare-spec.js` が flow.json 初期化時に `T-pending-spec` プレースホルダータスク（steps: []）を作成する。approval 後に `syncSpecTasksToFlow` → `promoteNextPending` が走ると、このプレースホルダーが `currentTaskId` に昇格し、以降のフローレベルステップの書き込み操作（`updateStepStatus` 等）が `unknown step` エラーで失敗する。

## 根本原因

「タスク未定」を空配列ではなくプレースホルダーで表現する設計判断。flow-store.js のスキーマ検証が tasks の非空を要求しているため導入されたが、promoteNextPending がプレースホルダーを本物のタスクと区別できない。

## 修正方針

1. flow-store.js の load() スキーマ検証を緩和し tasks: [] を許可する
2. run-prepare-spec.js から T-pending-spec を削除し tasks: [] で初期化する
3. run-gate.js の stripPendingSpecTask など関連コードを削除する

## 影響範囲

- src/lib/flow-store.js（スキーマ検証）
- src/flow/lib/run-prepare-spec.js（初期化）
- src/flow/lib/run-gate.js（stripPendingSpecTask）

</details>