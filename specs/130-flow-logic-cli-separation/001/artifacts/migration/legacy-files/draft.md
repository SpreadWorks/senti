# Draft: flow コマンドのロジック/CLI 分離

## Goal

全 flow コマンド（run/get/set）をロジック層と CLI 層に分離し、ロジック層は副作用なしの純粋関数として関数呼び出しできるようにする。

## 現状の問題

execute() の中に以下が混在：
- parseArgs（CLI 引数解析）
- help 表示（console.log）
- output()（stdout に JSON 出力 + process.exitCode 設定）
- ok/fail envelope の組み立て
- flowState の存在チェック等の共通バリデーション
- ビジネスロジック

関数として呼ぶと parseArgs が不要なのに通過し、output() が stdout を汚染し、process.exitCode が副作用を起こす。

## 決定事項

### 1. 3層構造

```
FlowCommand (基底クラス)
  └─ 共通処理: requiresFlow チェック等

各コマンド (src/flow/lib/<name>.js)
  └─ FlowCommand を継承。execute(ctx) をオーバーライド

ディスパッチャ (src/flow.js)
  └─ registry から定義を取得 → parseArgs → FlowCommand.run(ctx) → ok/fail → output
```

### 2. 基底クラス (FlowCommand)

```js
export class FlowCommand {
  constructor({ requiresFlow = true } = {}) {
    this.requiresFlow = requiresFlow;
  }

  run(ctx) {
    if (this.requiresFlow && !ctx.flowState) {
      throw new Error("no active flow");
    }
    return this.execute(ctx);
  }

  execute(ctx) {
    throw new Error("execute() must be implemented");
  }
}
```

- 共通バリデーション（flowState チェック等）を基底に集約
- 各コマンドは execute(ctx) だけ実装すればよい
- 全 27 コマンドに適用（一貫性重視）

### 3. ロジック層の規約

- output(), process.exitCode, parseArgs を使わない
- ok/fail envelope を使わない（flow-envelope に依存しない）
- 成功時: 素のオブジェクトを return
- 失敗時: 普通の Error を throw
- help を表示しない
- ctx を引数として受け取る（args は含まない。parseArgs 結果が ctx に展開される）

### 4. registry の宣言

各コマンドが args 定義、help テキスト、コマンドクラス、pre/post フックを持つ：

```js
gate: {
  args: { flags: ["--skip-guardrail", "--dry-run"], options: ["--spec"] },
  help: "Usage: sdd-forge flow run gate ...",
  command: () => import("./lib/gate.js"),
  pre: stepPre("gate"),
  post: stepPost("gate", ...),
},
```

### 5. ディスパッチャ（flow.js）の共通ラッパー

```
1. entry.args があれば parseArgs で引数解析、結果を ctx にマージ
2. ctx.help なら entry.help を表示して終了
3. entry.pre を実行
4. コマンドクラスをインスタンス化、run(ctx) を呼ぶ
5. 成功 → ok() envelope を output
6. 失敗 → catch して fail() envelope を output
7. entry.post を実行
```

run/get/set の個別ラッパーファイルは不要。

### 6. finalize.js からの呼び出し

lib/ のコマンドクラスを直接 import して run(ctx) を呼ぶ。ディスパッチャを経由しない。output/parseArgs/envelope が一切介在しない。

### 7. エラー設計

- ロジック層は普通の Error を throw する
- 専用 Error クラスや code プロパティは不要
- DIRTY_WORKTREE 等の条件分岐は AI に任せずコマンド内で解決する
- ディスパッチャが catch して fail() の code/message に変換する

### 8. ファイル構成の変更

- src/flow/run/*.js → 削除（ロジックは lib/ へ移動）
- src/flow/get/*.js → 削除（同上）
- src/flow/set/*.js → 削除（同上）
- src/flow/lib/base-command.js → 新規（FlowCommand 基底クラス）
- src/flow/lib/<name>.js → 新規（27 コマンド）
- src/flow/registry.js → args, help, command 定義を追加
- src/flow.js → runEntry に共通ラッパーを実装

### 9. スコープ

全 27 コマンド。

### 10. 既存機能への影響

- CLI 経由の動作は変わらない（ディスパッチャが envelope を組み立てて output）
- 関数呼び出し時の副作用がなくなる
- alpha 版ポリシーにより後方互換は不要

## テスト戦略

- spec 検証テスト: src/flow/lib/ の全ファイルが output, fail, ok, parseArgs を import していないことを静的検証
- 既存テスト全通過確認

- [x] User approved this draft
