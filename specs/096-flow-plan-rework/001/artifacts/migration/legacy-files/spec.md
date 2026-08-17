# Feature Specification: 096-flow-plan-rework

**Feature Branch**: `feature/096-flow-plan-rework`
**Created**: 2026-03-29
**Status**: Draft
**Input**: `.tmp/flow/02-flow-plan-rework.md` + `.tmp/flow_improvement.md`

## Goal

`flow-plan` skill テンプレートを新しい進行ルール（step 並び変更、draft 質問運用改善、gate 移動、test 再設計、metrics 反映）に合わせて更新する。合わせて全 skill テンプレートのコマンドを `flow get/set/run` 体系に移行する。

**Why**: 現在の flow-plan は draft の質問運用が不十分で AI が自由解釈しやすく、gate が approval 後にあるため不合理。test step の選択肢も曖昧。新しい進行ルールで spec 品質を向上させる。

## Scope

### 1. FLOW_STEPS 順序変更（`src/lib/flow-state.js`）
- `spec` → `prepare-spec` にリネーム
- `fill-spec` → `spec` にリネーム
- `gate` と `approval` の順序を入れ替え
- 新しい順序: `approach, branch, prepare-spec, draft, spec, gate, approval, test, implement, review, finalize, commit, push, merge, pr-create, branch-cleanup, ...`

### 2. flow-plan skill テンプレート書き換え（`src/templates/skills/sdd-forge.flow-plan/`）
- **step 並び**: 新しい8ステップに対応
- **draft フェーズ改善**:
  - `(n/N)` 進捗表示（`n` = `flow get qa-count` の値、`N` = AI が管理）
  - 全ターンで AI は必ず質問で終える
  - 推奨は原則毎回表示（簡潔に端的に、推奨選択肢を一番上に）
  - 選択式を基本にする
  - 要件カテゴリチェックリスト（5カテゴリ）
  - 各質問の後に `flow set metric draft question` でカウント
- **spec ステップ**: draft/issue、analysis.json、docs を読んで仕様書を作成
- **gate ステップ**: approval の前。FAIL は全部表示、都度承認不要、AI が自動修正して PASS まで進める
- **approval ステップ**: gate PASS 後の spec 全文を提示して承認
- **test ステップ再設計**: 「テストコード作成する / しない / その他」。`specs/<spec>/tests/` 配置規約

### 3. `flow get prompt plan.test-mode` 更新（`src/flow/get/prompt.js`）
- 選択肢を「テストコードを作成する / 作成しない / その他」に変更

### 4. 全 skill テンプレートのコマンド一括置換
- 旧 `flow status --step/--request/--note/--issue/--summary/--req/--check` → 新 `flow set/get` 体系
- 旧 `spec guardrail show` → `flow get guardrail`
- 旧 `spec gate` → `flow run gate`
- 旧 `spec init` → `flow run prepare-spec`
- 旧 `flow review/merge/cleanup` → `flow run review/merge/cleanup`

### 5. `specs/<spec>/tests` 配置規約
- 正式テストに組み込めない場合、`specs/<spec>/tests/` にテストコードを配置
- `node --test specs/<spec>/tests/*.js` で実行可能
- 履歴として保持するが継続メンテナンスはしない

### 6. PHASE_MAP 更新（`src/lib/flow-state.js`）
- `prepare-spec` → plan、`spec` → plan、gate/approval 順序反映

## Migration

spec 095 で `flow` コマンドは既に `get/set/run` 体系に移行済み。本 spec は skill テンプレート内のコマンド参照を新体系に合わせる作業であり、CLI 自体の変更ではない。

`FLOW_STEPS` のステップ名変更（`spec` → `prepare-spec`、`fill-spec` → `spec`）は alpha 版ポリシーにより後方互換エイリアスは設けない。既存の flow.json は新しいステップ名で再作成される。`sdd-forge upgrade` 実行でユーザー環境の skill テンプレートが更新される。

## Out of Scope

- flow-impl / flow-finalize の確認フロー変更（Task 03）
- include ディレクティブ（Task 04）
- redolog 学習ロジック（Task 05）
- guardrail 昇格ロジック

## Clarifications (Q&A)

- Q: 要件カテゴリのチェックリストはどこに置くか？
  - A: skill テンプレートに埋め込む。CLIデータではなくAIの行動指針。
- Q: draft の探索的設問は CLI が生成するか？
  - A: いいえ。`flow get prompt plan.draft` はハイブリッド kind。CLIはレイアウトデータのみ、AIが質問を生成する。
- Q: コマンド置換は flow-plan のみか？
  - A: 全 skill テンプレートを一括置換。
- Q: 終了コードの規約は？
  - A: spec 095 で定義済み。`ok: true` で exit 0、`ok: false` で exit 1。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-29
- Notes: ドラフト Q&A 完了後に承認

## Requirements

優先順位順（P1: 必須, P2: 重要, P3: あると良い）:

1. **P1**: `src/lib/flow-state.js` の `FLOW_STEPS` を新しい順序に変更する（`spec` → `prepare-spec`、`fill-spec` → `spec`、gate/approval 入れ替え）
2. **P1**: `src/lib/flow-state.js` の `PHASE_MAP` を新しいステップ名に更新する
3. **P1**: `src/templates/skills/sdd-forge.flow-plan/SKILL.en.md` を新しい step 並び・draft 運用・gate 移動・test 再設計に書き換える
4. **P1**: `src/templates/skills/sdd-forge.flow-plan/SKILL.ja.md` を同様に書き換える
5. **P1**: 全 skill テンプレート（flow-plan, flow-impl, flow-finalize, flow-sync, flow-resume, flow-status）のコマンドを `flow get/set/run` 体系に置換する
6. **P2**: `src/flow/get/prompt.js` の `plan.test-mode` の選択肢を「テストコードを作成する / 作成しない / その他」に更新する
7. **P2**: flow-plan skill テンプレートに `specs/<spec>/tests` の配置規約を記述する
8. **P2**: flow-plan skill テンプレートの draft フェーズに要件カテゴリチェックリスト（5カテゴリ）を記述する
9. **P2**: flow-plan skill テンプレートに `flow set metric draft question` の呼び出しを組み込む
10. **P3**: 既存テストの FLOW_STEPS 参照箇所を新しいステップ名に更新する

## Acceptance Criteria

1. `FLOW_STEPS` の先頭8要素が `approach, branch, prepare-spec, draft, spec, gate, approval, test` である
2. flow-plan skill テンプレートの step 順序が新しい並びに対応している
3. flow-plan skill テンプレートの draft フェーズに `(n/N)` 進捗表示、全ターン質問終了、推奨表示、チェックリストの指示が含まれる
4. flow-plan skill テンプレートの gate ステップが approval の前にあり、「FAIL は全部表示、AI が自動修正」の指示がある
5. flow-plan skill テンプレートの test ステップに「テストコード作成する / しない / その他」の選択肢がある
6. 全 skill テンプレートで旧コマンド `sdd-forge flow status --step` が使われていない
7. `flow get prompt plan.test-mode` が新しい選択肢を返す
8. flow-plan skill テンプレートに `specs/<spec>/tests` の配置規約が記述されている
9. 既存テストが新しい FLOW_STEPS で PASS する

## Open Questions

- (なし)
