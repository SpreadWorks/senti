# Feature Specification: 095-flow-command-foundation

**Feature Branch**: `feature/095-flow-command-foundation`
**Created**: 2026-03-29
**Status**: Draft
**Input**: `.tmp/flow/01-flow-command-foundation.md` + `.tmp/flow_improvement.md`

## Goal

`flow` コマンドを `get / set / run` の3サブコマンドに再編し、すべてのレスポンスを JSON envelope で統一する。既存の `flow status/review/merge/cleanup/resume/start` を廃止し、新体系に移行する。

**Why**: 現在の flow コマンドはテキスト出力が混在しており、skill（SKILL.md）がパース困難。JSON 統一により skill とコマンドの連携を構造化し、壊れにくくする。

## Scope

### 基盤
- `src/lib/flow-envelope.js` — JSON envelope 生成ユーティリティ
- `src/flow.js` — `get/set/run` への1段目ディスパッチに書き換え
- `src/flow/get.js`, `src/flow/set.js`, `src/flow/run.js` — 2段目ディスパッチャ

### flow get（読み取り）
| key | 移行元 | 内容 |
|-----|--------|------|
| `status` | `flow status`（表示モード） | フロー状態を JSON で返す |
| `resolve-context` | `flow resume` | mainRepoPath, worktreePath, activeFlow, flow.json path を確定して返す |
| `check <target>` | `flow status --check` | impl/finalize/dirty/gh の前提条件チェック |
| `prompt <kind>` | 新規 | 定型設問を構造化 JSON で返す（14種） |
| `qa-count` | 新規 | 回答済み質問数を返す |
| `guardrail <phase>` | `spec guardrail show` | ガードレール記事をフェーズでフィルタして返す |

### flow set（書き込み）
| key | 移行元 | 内容 |
|-----|--------|------|
| `step <id> <status>` | `flow status --step` | ステップ状態更新 |
| `request "<text>"` | `flow status --request` | ユーザーリクエスト設定 |
| `issue <number>` | `flow status --issue` | GitHub Issue 番号設定 |
| `note "<text>"` | `flow status --note` | メモ追記 |
| `summary '<json>'` | `flow status --summary` | 要件リスト設定 |
| `req <index> <status>` | `flow status --req` | 要件ステータス更新 |
| `metric <step> <counter>` | 新規 | メトリクスインクリメント |
| `redo` | 新規 | redolog.json に差し戻し記録追記 |

### flow run（実行）
| action | 移行元 | 内容 |
|--------|--------|------|
| `prepare-spec` | `spec init` | ブランチ/worktree 作成 + spec 初期化 |
| `gate` | `spec gate` | 仕様書ゲートチェック |
| `review` | `flow review` | AI コードレビュー |
| `impl-confirm` | 新規 | 実装前確認（`--mode overview\|detail`） |
| `merge` | `flow merge` | マージ実行（`--auto`, `--pr`, `--dry-run`） |
| `cleanup` | `flow cleanup` | ブランチ/worktree 削除（`--dry-run` で確認、`--force` で強制削除） |

### 削除
- `src/flow/commands/start.js` — `flow run prepare-spec` に置き換え
- `src/flow/commands/status.js` — `flow get status` + `flow set *` に分割
- `src/flow/commands/resume.js` — `flow get resolve-context` に移行
- `src/flow/commands/review.js` — `flow run review` に移行
- `src/flow/commands/merge.js` — `flow run merge` に移行
- `src/flow/commands/cleanup.js` — `flow run cleanup` に移行

### ロジック移動
- `spec/commands/init.js` のロジック → `flow/run/prepare-spec.js`
- `spec/commands/gate.js` のロジック → `flow/run/gate.js`
- `spec/commands/guardrail.js` の `runShow()` + `loadMergedArticles()` + `filterByPhase()` → `flow/get/guardrail.js`
- `spec/commands/guardrail.js` の `init/update` サブコマンドは残す

### 更新
- `src/help.js` — 新コマンド体系の表示
- `src/locale/*/ui.json` — flow 関連ヘルプ文
- `src/locale/*/messages.json` — flow 関連メッセージ
- `src/templates/skills/*` — `flow get/set/run` を使う形に更新

## Migration

alpha 版ポリシーにより後方互換エイリアスは設けない。旧コマンド実行時は以下のエラーメッセージで新コマンドへの対応を案内する:

```
sdd-forge flow: unknown command 'status'
Run: sdd-forge flow --help

Subcommands:
  get    Read flow state (status, check, prompt, ...)
  set    Update flow state (step, req, note, ...)
  run    Execute flow actions (prepare-spec, gate, merge, ...)
```

skill テンプレート（`src/templates/skills/*`）は本 spec で同時に更新するため、`sdd-forge upgrade` 実行後にユーザー環境のスキルも新コマンドに切り替わる。

### 移行手順

1. `npm update sdd-forge` でパッケージを更新する
2. `sdd-forge upgrade` を実行し、ローカルの skill テンプレート（`.claude/skills/`, `.agents/skills/`）を新コマンド体系に更新する
3. 旧コマンド（`flow status`, `flow merge` 等）を使っているカスタムスクリプトがある場合は、`flow get/set/run` に手動で書き換える

alpha 版のため、旧コマンドのエイリアスやデプリケーション警告は設けない。

## Out of Scope

- include ディレクティブ（Task 04）
- `upgrade` のテンプレート再構成（Task 04）
- guardrail 昇格ロジック（Task 05 以降）
- flow-plan の step 並び変更（Task 02）
- flow-impl / flow-finalize の確認フロー変更（Task 03）
- `spec` コマンド全体の整理（別スコープ）

## Clarifications (Q&A)

- Q: envelope に warnings フィールドは必要か？
  - A: 不要。`errors[{level: "warn"|"fatal", code, messages}]` で統一。
- Q: 既存コマンド名のエイリアスは残すか？
  - A: alpha 版ポリシーにより不要。即座に廃止。
- Q: `flow get prompt` の kind はどう決まるか？
  - A: 14種を定義（plan.approach, plan.work-environment 等）。定型設問は CLI が生成、draft/review はハイブリッド。
- Q: `flow set metric` の操作は？
  - A: `flow set metric <step> <counter>` でインクリメント（+1）。スキーマ: `{draft,spec,gate,test}×{question,redo,docsRead,srcRead}`
- Q: `spec init/gate` のロジックをどこに置くか？
  - A: `flow/` に移動。`spec guardrail init/update` のみ残す。
- Q: 終了コードの規約は？
  - A: `ok: true` のとき終了コード 0、`ok: false` のとき終了コード 1。未知のサブコマンドは stderr にエラーメッセージを出力し終了コード 1 で終了する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-29
- Notes: ドラフト Q&A 完了後に承認

## Requirements

優先順位順（P1: 必須, P2: 重要, P3: あると良い）:

1. **P1**: `flow.js` を `get/set/run` の1段目ディスパッチに書き換える
2. **P1**: `src/lib/flow-envelope.js` に JSON envelope 生成関数を実装する。形式: `{ok, type, key, data, errors[{level, code, messages}]}`
3. **P1**: `src/flow/get.js` ディスパッチャと `flow/get/status.js` を実装し、フロー状態を JSON で返す
4. **P1**: `src/flow/set.js` ディスパッチャと全 set ハンドラ（step, request, issue, note, summary, req, metric, redo）を実装する
5. **P1**: `src/flow/run.js` ディスパッチャと既存移行（prepare-spec, gate, review, merge, cleanup）を実装する
6. **P1**: `flow get resolve-context` を実装し、mainRepoPath/worktreePath/activeFlow/flow.json path を返す
7. **P1**: `flow get check` を実装し、impl/finalize/dirty/gh の4つの target に対応する
8. **P2**: `flow get prompt <kind>` を実装する。以下の14種の kind に対応し、`{phase, step, current, total, prompt, description, recommendation, choices[{id, label, description, recommended}]}` を返す。
   - `plan.approach` — 仕様書作成方法の選択（Q&A / 直接作成）
   - `plan.work-environment` — 作業環境の選択（worktree / branch / なし）
   - `plan.dirty-worktree` — 未コミット変更がある場合の対処選択（commit / stash / その他）
   - `plan.approval` — 仕様書承認の確認（承認 / 修正 / その他）
   - `plan.test-mode` — テスト種類の選択（仕様ベース / unit / e2e / unit+e2e）
   - `plan.draft` — ドラフト承認の確認
   - `impl.review-mode` — レビュー方針の選択（実行 / スキップ / その他）
   - `impl.review-item` — レビュー指摘の適用確認
   - `impl.confirmation` — 実装完了後の次操作選択（終了処理 / 修正に戻る / その他）
   - `finalize.mode` — 終了処理の範囲選択（すべて / 個別）
   - `finalize.steps` — 個別ステップの選択（コミット / マージ / ブランチ削除 / ドキュメント同期 / 記録保存）
   - `finalize.merge-strategy` — マージ方法の選択（merge / squash / PR）
   - `finalize.cleanup` — worktree/ブランチ削除の確認
   - 静的 kind（CLI が選択肢をすべて生成）: `plan.approach`, `plan.work-environment`, `plan.dirty-worktree`, `plan.approval`, `plan.test-mode`, `impl.review-mode`, `impl.confirmation`, `finalize.mode`, `finalize.steps`, `finalize.merge-strategy`, `finalize.cleanup`
   - ハイブリッド kind（CLI がレイアウト用データ `{phase, current, total}` を返し、AI が `prompt`/`description`/`choices` を埋める）: `plan.draft`, `impl.review-item`
   - ハイブリッド kind の場合、`choices` は空配列で返し、AI が context に応じて動的に生成する
9. **P2**: `flow get guardrail <phase>` を実装する。`spec guardrail show` のロジックを移動し JSON で返す
10. **P2**: `flow get qa-count` を実装し、flow.json から回答済み質問数を返す
11. **P2**: `flow run impl-confirm` を実装する。`--mode overview|detail` を受け取る。overview モードの場合、flow.json の requirements と steps を読み取り、各要件の充足状態と現在のフェーズを `{result, changed, artifacts, next}` 形式で返す。detail モードの場合、`git diff <baseBranch>...HEAD` の差分ファイル一覧と requirements の対応を返す。`next` フィールドには推奨される次の行動（"finalize", "fix", "review" 等）を含める
12. **P2**: `sdd-forge flow set metric <phase> <counter>` を実行したとき、flow.json の `metrics.{phase}.{counter}` を +1 インクリメントし、更新後の値を JSON envelope で返す
13. **P2**: `flow set redo` を実装する。`--step/--reason/--trigger/--resolution/--guardrail-candidate` で redolog.json に追記
14. **P3**: P1/P2 の全要件の実装が完了し、テストが通った後に、旧コマンドファイル（`src/flow/commands/start.js`, `status.js`, `resume.js`, `review.js`, `merge.js`, `cleanup.js`）を削除する
15. **P3**: `src/help.js` と `src/locale/*/ui.json`, `src/locale/*/messages.json` を新コマンド体系に更新する
16. **P3**: skill テンプレート（`src/templates/skills/*`）を `flow get/set/run` を使う形に更新する

## Acceptance Criteria

1. `sdd-forge flow get status` が JSON envelope でフロー状態を返す
2. `sdd-forge flow set step approach done` が JSON envelope で成功を返し、flow.json が更新される
3. `sdd-forge flow run merge` が JSON envelope でマージ結果を返す
4. `sdd-forge flow get prompt plan.approach` が構造化された選択肢を JSON で返す
5. `sdd-forge flow get check impl` が JSON envelope で前提条件チェック結果を返す
6. `sdd-forge flow get guardrail draft` がガードレール記事を JSON で返す
7. `sdd-forge flow set metric draft question` が flow.json の `metrics.draft.question` をインクリメントする
8. `sdd-forge flow get resolve-context` が mainRepoPath/worktreePath を含む JSON を返す
9. `sdd-forge flow --help` が新しいコマンド体系（get/set/run）を表示する
10. 旧コマンド `sdd-forge flow status` が "unknown command" エラーを返す
11. skill テンプレートが `flow get/set/run` を使う形に更新されている

## Open Questions

- (なし)
