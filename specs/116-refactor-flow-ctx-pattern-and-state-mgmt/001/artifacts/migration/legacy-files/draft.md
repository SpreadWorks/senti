# Draft: Refactor flow subsystem — ctx pattern and state management

## Issue

GitHub Issue #56: flow サブシステムのリファクタリング

## Background

Issue #43（flow run review が worktree モードで動作しない）の調査で、flow サブシステム全体の設計課題が判明。redolog で5回同じ worktree パス解決問題が記録されていた。

## Q&A Summary

### Q1: ctx の構造と解決場所
- flow.js で flowState, config を解決し ctx としてコマンドに渡す
- prepare は flowState 不要なので `flow prepare` としてトップレベルに分離
- get/set/run は flowState 必須。なければエラー停止

### Q2: runIfDirect の廃止
- ctx パターンでは直接実行不要。runIfDirect を全 flow コマンドから削除
- ディスパッチャーが `mod.execute(ctx)` を明示的に呼ぶ

### Q3: before/after フック
- registry.js に before/after を汎用フックとして定義可能
- 設定されていれば実行、なければスキップ
- run だけでなくどのコマンドにも設定可能
- 用途はステート更新に限定しない

### Q4: CLI インターフェース変更
- `sdd-forge flow run prepare-spec` → `sdd-forge flow prepare` に変更
- alpha 版ポリシーで旧パス非保持
- skill テンプレート（src/templates/skills/）も同時更新

### Q5: テスト戦略
- ctx 解決と registry ディスパッチは tests/unit/flow/ に正規テスト
- 既存 99 テスト全 PASS を確認
- E2E は手動確認

## Design

### registry.js の新構造

```js
export const FLOW_COMMANDS = {
  prepare: {
    helpKey: "flow.prepare",
    requiresFlow: false,
    execute: () => import("./run/prepare-spec.js"),
  },
  get: {
    status: {
      helpKey: "flow.get.status",
      execute: () => import("./get/status.js"),
    },
    // ...
  },
  set: {
    step: {
      helpKey: "flow.set.step",
      execute: () => import("./set/step.js"),
    },
    // ...
  },
  run: {
    gate: {
      helpKey: "flow.run.gate",
      before: (ctx) => updateStepStatus(ctx.root, "gate", "in_progress"),
      execute: () => import("./run/gate.js"),
      after: (ctx, result) => updateStepStatus(ctx.root, "gate", result.pass ? "done" : "pending"),
    },
    // ...
  },
};
```

### flow.js のディスパッチ

```js
if (group === "prepare") {
  const mod = await entry.execute();
  await mod.execute();
} else {
  const ctx = { root, config, flowState, ... };
  if (entry.before) entry.before(ctx);
  const mod = await entry.execute();
  const result = await mod.execute(ctx);
  if (entry.after) entry.after(ctx, result);
}
```

### 各コマンドの変更

- `export function main()` → `export async function execute(ctx)`
- `runIfDirect` 削除
- `loadFlowState`, `loadConfig`, `repoRoot` の個別呼び出し削除
- ctx から必要な値を取得

## Requirements

1. flow.js で ctx（root, config, flowState）を解決し全コマンドに渡す
2. registry.js を拡張し before/execute/after の宣言的定義にする。ヘルプは helpKey で i18n 参照
3. prepare を `flow prepare` としてトップレベルに分離。flowState 不要
4. 全 run/get/set コマンドから runIfDirect を削除し execute(ctx) シグネチャに統一
5. review の子プロセス起動を廃止し直接 import に変更
6. worktree 内では branch 名から spec ID を導出し flow.json を直接読む
7. run コマンドの before/after で flowState を自動更新（ハイブリッド方式）
8. prepare-spec の config フォールバックを廃止。config.json 必須でエラー停止
9. skill テンプレートの `flow run prepare-spec` を `flow prepare` に更新

## Approval

- [x] User approved this draft
- Date: 2026-04-01
