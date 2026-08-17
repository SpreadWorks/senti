# Draft: flow-state runIdベースのpreparing状態管理とresume復元

**開発種別:** 機能追加 (Enhancement)

**目的:** flow-plan の prepare 実行前（ステップ1〜2）に状態追跡の空白期間が存在し、クラッシュ時に痕跡が残らない問題を解決する。runId ベースの一時状態ファイルを導入し、フローのライフサイクル全体を追跡可能にする。

## Q&A

### Q1: スコープ
Issue #137 の全タスク（runId発番・保存・status解決・resume復元・autoApproveタイミング修正・stale cleanup・テスト）を1つの spec で実装する。

### Q2: runId の生成タイミング
`sdd-forge flow set init`（新コマンド）で、ステップ1（アプローチ選択）の前に `.active-flow.<runId>` を作成する。prepare より前に状態を永続化することで空白期間をなくす。

フロー:
```
Step 0: sdd-forge flow set init        → .sdd-forge/.active-flow.<runId> 作成（preparing）
Step 1: アプローチ選択
Step 2: 作業環境選択
Step 3: sdd-forge flow prepare --run-id <runId>  → flow.json + .active-flow 昇格、.active-flow.<runId> 削除
Step 4: ドラフト〜
```

### Q3: `.active-flow.<runId>` のファイルフォーマット
flow.json と完全に同一スキーマを使用する。未定フィールド（spec, baseBranch, featureBranch 等）は null で埋める。lifecycle フィールドを追加して状態を区別する。

### Q4: 配置と昇格後の扱い
- 配置: `.sdd-forge/.active-flow.<runId>`
- `flow prepare` で `specs/NNN/flow.json` + `.active-flow` エントリに昇格後、`.active-flow.<runId>` は削除する。

### Q5: `flow get status <runId>` の解決ロジック
- 引数なしは従来動作を維持（後方互換）
- `flow get status <runId>` 指定時のみ runId 解決を使用
- 解決順: `.active-flow` 経由の flow.json の runId 一致 → `.active-flow.<runId>` フォールバック → RUN_ID_NOT_FOUND エラー

### Q6: stale クリーンアップ
- `flow prepare` 実行時に mtime ベースで TTL 超過（24時間）の `.active-flow.*` ファイルを自動削除
- 明示的クリーンアップコマンドは追加しない
- 既存の `cleanStaleFlows` と同タイミングで実行

### Q7: 既存フロー移行
- `loadFlowState` で読み込み時に `runId` が無ければ自動採番して保存（透過的移行）
- 既存フローを壊さずにシームレスに移行

## 影響範囲

### 変更が必要なファイル
- `src/lib/flow-state.js` — runId 生成、`.active-flow.<runId>` CRUD、loadFlowState の移行ロジック、stale cleanup 拡張
- `src/flow/set.js` — `init` サブコマンドのディスパッチ追加
- `src/flow/set/init.js` — 新規ファイル。`.active-flow.<runId>` 作成
- `src/flow/lib/run-prepare-spec.js` — `--run-id` オプション受取、runId を flow.json に保存、`.active-flow.<runId>` 削除
- `src/flow/get/status.js` — runId 引数対応、runId 解決ロジック追加
- `src/flow/registry.js` — `set init` コマンドの登録、`prepare` に `--run-id` オプション追加
- `src/flow/lib/run-resume.js` — runId 復元ロジック
- SKILL.md テンプレート — Step 0 追加

### 既存機能への影響
- `flow get status` 引数なしは動作変更なし
- `flow prepare` は `--run-id` なしでも従来通り動作
- 既存 flow.json は loadFlowState 時に runId が自動付与される（透過的）
- `.active-flow` の配列フォーマットは変更なし

## autoApprove ルール
- `.active-flow.<runId>` 状態（preparing）では autoApprove 判定を行わない（manual 固定）
- `flow prepare` 成功後、`flow get status` で autoApprove を正式に読み取って適用する
- 現在の実装でも prepare 前は autoApprove を設定できないため、動作変更は最小限

## 並列・クラッシュ時の考慮
- runId を一意キーにし、複数の preparing/aborted 状態を識別可能にする
- 複数の `.active-flow.<runId>` の共存を許容
- 同一コンテキストで複数 active にならない競合ガード: `flow set init` 時に既存の preparing ファイルがあれば警告
- stale ファイルは `flow prepare` 時に TTL ベースで自動削除

## CLI 互換性と移行計画

### 新規コマンド
- `sdd-forge flow set init` — 新規追加。既存コマンドとの衝突なし。

### 既存コマンドの変更
- `sdd-forge flow prepare` に `--run-id <runId>` オプションを追加（任意）。
  - `--run-id` なし: 従来通り runId を新規採番して flow.json に保存。動作変更なし。
  - `--run-id` あり: 指定された runId を使用し、対応する `.active-flow.<runId>` を削除。
- `sdd-forge flow get status` に任意の位置引数 `<runId>` を追加。
  - 引数なし: 従来の解決ロジックをそのまま使用。動作変更なし。
  - 引数あり: runId ベースの解決を使用。

### SKILL.md テンプレートの移行
- `src/templates/skills/` 内の flow-plan SKILL.md テンプレートに Step 0（`sdd-forge flow set init`）を追加。
- `sdd-forge upgrade` を実行することで、既存プロジェクトの SKILL.md に反映される。
- `flow set init` なしで `flow prepare` を直接呼んでも従来通り動作するため、SKILL.md 未更新のプロジェクトでも壊れない。

## テスト方針
- runId 生成・保存のユニットテスト
- `.active-flow.<runId>` の CRUD テスト
- `flow get status <runId>` の解決ロジックテスト
- `loadFlowState` の透過的移行テスト
- stale cleanup テスト
- prepare 時の昇格・削除テスト

- [x] User approved this draft (2026-04-13)
