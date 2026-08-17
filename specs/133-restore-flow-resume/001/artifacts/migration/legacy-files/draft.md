# Draft: flow resume コマンドの復活

## Goal
`flow resume` コマンドを復活させ、コンパクション後やworktree外からフローを発見・復帰できるようにする。

## Decisions

1. **実装方式**: 独立コマンド `flow resume` として `registry.js` に登録（`prepare` と対称）
2. **フロー探索ロジック**: 共通ヘルパー（`resolveActiveFlow(root)` 等）に抽出し、resume と get-resolve-context の両方から使う
3. **3段階フォールバック**: `scanAllFlows` を共通ヘルパーに含め、resume/get-resolve-context 両方で使えるようにする
4. **出力フォーマット**: JSON envelope 形式（`get-resolve-context` と同構造）
5. **スコープ**: コマンド実装 + 共通ヘルパー抽出 + SKILL.md テンプレート更新 + `sdd-forge upgrade` 実行

## Scope

### やること
- `src/flow/lib/` に共通フロー探索ヘルパーを作成（3段階フォールバック）
- `src/flow/lib/` に resume コマンドを実装（FlowCommand, requiresFlow: false）
- `src/flow/registry.js` に resume を登録（トップレベルコマンド）
- `src/flow.js` ディスパッチャに resume ルーティングを追加
- `get-resolve-context.js` を共通ヘルパーを使うようリファクタ
- `src/templates/skills/sdd-forge.flow-resume/SKILL.md` を更新
- `sdd-forge upgrade` でプロジェクト側スキルに反映

### やらないこと
- get-resolve-context のインターフェース変更（出力構造は維持）
- 新しい flow get/set サブコマンドの追加

## Impact
- `get-resolve-context.js`: フロー探索ロジックを共通ヘルパーに移行（動作は変わらない）
- `registry.js`: resume コマンド追加
- `flow.js`: resume ルーティング追加
- SKILL.md テンプレート: `sdd-forge flow resume` を呼ぶだけに簡素化

## Approval
- [x] User approved this draft
