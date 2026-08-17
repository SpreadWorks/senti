# Feature Specification: 101-remove-spec-js-dispatcher-and-clean-up-command-s

**Feature Branch**: `feature/101-remove-spec-js-dispatcher-and-clean-up-command-s`
**Created**: 2026-03-30
**Status**: Draft
**Input**: User request (.tmp/command-cleanup.md)

## Goal

`spec.js` ディスパッチャを廃止し、spec 系コマンドを flow に統合する。孤立した flow/run ファイルを削除し、guardrail の共有ロジックを lib に切り出す。

## Scope

### 削除対象
- `src/spec.js` — ディスパッチャ。全コマンドが flow に移行済みまたは廃止
- `src/spec/commands/init.js` — `flow/run/prepare-spec.js` が吸収済み
- `src/spec/commands/gate.js` — `flow/run/gate.js` が吸収済み
- `src/spec/commands/guardrail.js` の `init`/`update` サブコマンド — 未使用（自動学習は別スコープ）
- `src/spec/commands/lint.js` — flow に移動
- `src/flow/run/merge.js` — 孤立（registry なし、finalize が直接 commands/ を呼ぶ）
- `src/flow/run/cleanup.js` — 同上

### 移動
- `spec/commands/guardrail.js` の共有ロジック（`loadMergedArticles`, `filterByPhase`, `parseGuardrailArticles`, `matchScope`）→ `src/lib/guardrail.js`
- `spec/commands/lint.js` のロジック → `src/lib/lint.js` + `src/flow/run/lint.js`

### 参照元の更新
- `src/sdd-forge.js` — `spec` サブコマンドのルーティング削除
- `src/flow/registry.js` — `flow run lint` を追加
- `src/flow/get/guardrail.js` — import を `spec/commands/guardrail.js` → `lib/guardrail.js` に変更
- `src/flow/run/prepare-spec.js` — `spec/commands/init.js` の呼び出しをロジック直接持ちに変更
- `src/flow/run/gate.js` — `spec/commands/gate.js` の呼び出しをロジック直接持ちに変更
- `src/help.js` — LAYOUT から `spec init`, `spec gate`, `spec guardrail` セクション削除
- `src/locale/{en,ja}/ui.json` — spec 関連ヘルプテキスト削除

### 残す（変更なし）
- `flow/commands/review.js` — `flow/run/review.js` が runSync で呼ぶ
- `flow/commands/merge.js` — `flow/run/finalize.js` が runSync で呼ぶ
- `flow/commands/cleanup.js` — `flow/run/finalize.js` が runSync で呼ぶ

## Out of Scope

- guardrail のデータ形式を JSON に移行（ボード 5609）
- guardrail の自動学習（ボード 4d21）
- `spec/commands/guardrail.js` の `show` サブコマンドの移行（既存の `flow get guardrail` で代替可能か別途検討）

## Clarifications (Q&A)

- Q: `prepare-spec.js` と `gate.js` が現在 `runSync` で init.js / gate.js を呼んでいるが、どう変更するか？
  - A: 各ファイルのロジックを直接取り込む。runSync による子プロセス呼び出しを関数呼び出しに変更する。

- Q: `spec/commands/` ディレクトリは残すか？
  - A: guardrail.js の `show` サブコマンドのみ残る可能性があるが、共有ロジックが lib に移動した後は `spec/commands/` 自体を削除し、`show` が必要なら `flow get guardrail` で代替する。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-30
- Notes: 合意済み方針(.tmp/command-cleanup.md)に基づく仕様。修正なしで承認。

## Requirements

### 実行順序と優先度

Phase 1（共有ロジック抽出）→ Phase 2（参照元の書き換え）→ Phase 3（旧ファイル削除・UI 更新）の順に実施する。

### 前提条件

- alpha 版ポリシーにより後方互換コード（deprecation 警告・移行ガイド）は不要。旧パスは保持せず削除する。
- `sdd-forge spec *` は flow 経由でのみ実行されるため、直接呼び出すユーザーはいない。

### Phase 1: 共有ロジック抽出（優先度: 高）

1. `src/spec/commands/guardrail.js` から共有関数（`loadMergedArticles`, `filterByPhase`, `parseGuardrailArticles`, `matchScope`）を `src/lib/guardrail.js` に抽出する
2. `src/spec/commands/lint.js` のロジックを `src/lib/lint.js` に抽出し、CLI エントリポイントを `src/flow/run/lint.js` に作成する
3. `src/flow/registry.js` に `run.lint` を追加する

### Phase 2: 参照元の書き換え（優先度: 高）

4. `src/flow/run/prepare-spec.js` を書き換え、`spec/commands/init.js` のロジックを直接持つようにする（runSync 廃止）
5. `src/flow/run/gate.js` を書き換え、`spec/commands/gate.js` のロジックを直接持つようにする（runSync 廃止）
6. `src/flow/get/guardrail.js` の import を `lib/guardrail.js` に変更する

### Phase 3: 削除と UI 更新（優先度: 中）

7. `src/spec.js` ディスパッチャを削除する
8. `src/sdd-forge.js` から `spec` サブコマンドのルーティングを削除する
9. `src/spec/commands/init.js`, `src/spec/commands/gate.js`, `src/spec/commands/lint.js` を削除する
10. `src/spec/commands/guardrail.js` を削除する（共有ロジックは lib に移動済み、init/update は未使用、show は flow get guardrail で代替）
11. `src/spec/commands/` ディレクトリと `src/spec/` ディレクトリを削除する
12. `src/flow/run/merge.js` と `src/flow/run/cleanup.js` を削除する
13. `src/help.js` から Spec セクションを削除する
14. `src/locale/{en,ja}/ui.json` から spec 関連エントリを削除する

## Acceptance Criteria

- `sdd-forge flow run prepare-spec` が正常動作する（spec ディレクトリ・ブランチ・worktree 作成）
- `sdd-forge flow run gate` が正常動作する（spec バリデーション）
- `sdd-forge flow run lint` が正常動作する（guardrail lint パターン適用）
- `sdd-forge flow get guardrail <phase>` が正常動作する
- `sdd-forge spec` コマンドが存在しない（エラーまたはヘルプに表示されない）
- `src/spec/` ディレクトリが存在しない
- `src/flow/run/merge.js`, `src/flow/run/cleanup.js` が存在しない
- 既存テストが通る

## Open Questions

- [x] `spec/commands/guardrail.js` の `show` サブコマンドは flow get guardrail で完全に代替できるか？ → Yes。`flow/get/guardrail.js` が `loadMergedArticles` + `filterByPhase` を使って同等の機能を提供済み。
