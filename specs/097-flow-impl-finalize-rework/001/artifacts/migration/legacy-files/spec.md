# Feature Specification: 097-flow-impl-finalize-rework

**Feature Branch**: `feature/097-flow-impl-finalize-rework`
**Created**: 2026-03-29
**Status**: Draft
**Input**: `.tmp/flow/03-flow-impl-finalize-rework.md` + `.tmp/flow_improvement.md`

## Goal

`flow-impl` と `flow-finalize` の skill テンプレートを、確認しやすさと worktree 安定性を重視した進行に更新する。review 方針の3択化、指摘の1件ずつ提示、impl-confirm による実装確認、finalize の context 解決強化、merge/cleanup の分岐安定化を行う。

**Why**: 現在の flow-impl は実装内容の可視化が弱く、ユーザーが別コンソールで `git diff` を見ないと判断しづらい。finalize は worktree モードでパスを取り違えやすく、merge/cleanup の分岐判断が AI に依存しすぎている。

## Scope

### 1. flow-impl skill テンプレート書き換え（`src/templates/skills/sdd-forge.flow-impl/`）

**step 2: Review**
- 方針3択: 「自動改善 / レビューのみ / しない」
- 「自動改善」選択時: 現行通り `flow run review` を実行し、一括で改善を適用
- 「レビューのみ」選択時: `flow run review` で proposals を取得し、1件ずつ提示
  - 各件で「問題 / 修正方針 / 今回の spec に必要か」を短く示す
  - `(n/N)` 進捗表示
  - 各件の最後は必ず質問で終える（適用する/しない/修正方針を変える）
  - その場では修正しない — 全指摘の回答を集めてからまとめて反映
- 「しない」選択時: review をスキップ

**step 3: Final confirmation (impl-confirm)**
- 選択肢を「承認 / 概要確認 / 詳細確認 / その他」に変更
- 「概要確認」: `flow run impl-confirm --mode overview` → 変更ファイル一覧、主要変更の要約、仕様外変更の有無、テスト結果
- 「詳細確認」: `flow run impl-confirm --mode detail` → requirement 単位で1件ずつ確認（対応仕様、変更ファイル、実装要点、仕様外変更の有無）
- 「承認」: そのまま flow-finalize に進む

### 2. flow-finalize skill テンプレート書き換え（`src/templates/skills/sdd-forge.flow-finalize/`）

**step 0: 説明追加**
- 「すべて実行」「個別に選択する」の各選択肢に description を追加

**step 1: context/path 解決強化**
- `flow get resolve-context` を呼び、`mainRepoPath`, `worktreePath`, `activeFlow`, `flowJsonPath` を確定
- 以後の全操作でこのパスを使用
- worktree モードでは merge は `mainRepoPath` 側、ファイル操作は `worktreePath` 側で行うルールを明記

**merge/cleanup 分岐安定化**
- worktree/branch/spec-only の判定ロジックを skill から除去
- `flow run merge` / `flow run cleanup` に分岐を委ね、JSON 結果を使って次の行動を決める

### 3. prompt kind 更新（`src/flow/get/prompt.js`）

| kind | 変更 |
|------|------|
| `impl.review-mode` | 「はい/スキップ/その他」→「自動改善/レビューのみ/しない」 |
| `impl.confirmation` | 「終了処理開始/修正に戻る/その他」→「承認/概要確認/詳細確認/その他」 |
| `finalize.mode` | 各 choice に description を追加 |

### 4. flow 共通 Hard Stops 更新
- impl 固有: gate PASS と test 完了前に実装しない
- finalize 固有: dirty tree のまま merge しない、destructive git command を使わない

## Out of Scope

- include ディレクティブ（Task 04）
- redolog 学習ロジック（Task 05）
- flow-plan の変更（Task 02 で完了済み）
- `flow run impl-confirm` の内部ロジック変更（spec 095 で実装済み、テンプレートから呼ぶだけ）

## Migration

skill テンプレートの書き換えのみ。CLI コマンドの変更はなし（prompt.js の定数更新のみ）。`sdd-forge upgrade` でユーザー環境に反映。

## Clarifications (Q&A)

- Q: review の「自動改善」と「レビューのみ」の違いは？
  - A: 自動改善は AI が proposals を生成し承認済みのものを一括適用。レビューのみは proposals を 1 件ずつユーザーに提示し、ユーザーの判断を集めてから反映。
- Q: impl-confirm の概要と詳細の違いは？
  - A: 概要は変更ファイル一覧 + 要件充足サマリー。詳細は requirement 単位で 1 件ずつ確認。
- Q: finalize で worktree path を取り違える問題の原因は？
  - A: `.active-flow` が main repo 側にあるが、ファイル操作は worktree 側で行う必要がある。`flow get resolve-context` で両方のパスを明示的に確定することで解決。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-03-29
- Notes: ドラフト Q&A 完了後に承認

## Requirements

優先順位順（P1: 必須, P2: 重要, P3: あると良い）:

1. **P1**: flow-impl SKILL.en.md の review ステップを3択（自動改善/レビューのみ/しない）に書き換える
2. **P1**: flow-impl SKILL.en.md の「レビューのみ」時に1件ずつ提示するフローを記述する（(n/N) 表示、各件質問終了、全回答後まとめて反映）
3. **P1**: flow-impl SKILL.en.md の最終確認を「承認/概要確認/詳細確認/その他」に書き換え、`flow run impl-confirm` を使用する
4. **P1**: flow-impl SKILL.ja.md を同様に書き換える
5. **P1**: flow-finalize SKILL.en.md の step 1 で `flow get resolve-context` を呼んでパスを確定するよう書き換える
6. **P1**: flow-finalize SKILL.en.md の merge/cleanup セクションから worktree/branch 判定ロジックを除去し、`flow run merge`/`flow run cleanup` の結果に基づく形にする
7. **P1**: flow-finalize SKILL.ja.md を同様に書き換える
8. **P2**: `src/flow/get/prompt.js` の `impl.review-mode` を「自動改善/レビューのみ/しない」に更新する
9. **P2**: `src/flow/get/prompt.js` の `impl.confirmation` を「承認/概要確認/詳細確認/その他」に更新する
10. **P2**: `src/flow/get/prompt.js` の `finalize.mode` の各 choice に description を追加する
11. **P2**: flow-finalize SKILL.en.md/ja.md の step 0 に選択肢の説明を追加する
12. **P3**: flow-impl/finalize の Hard Stops を共通土台 + phase 固有に整理する

## Acceptance Criteria

1. flow-impl skill テンプレートの review ステップに3択の選択肢がある
2. 「レビューのみ」選択時の1件ずつ提示フローが記述されている（(n/N) 表示を含む）
3. flow-impl skill テンプレートの最終確認に「承認/概要確認/詳細確認/その他」がある
4. flow-finalize skill テンプレートの step 1 で `flow get resolve-context` を呼んでいる
5. flow-finalize skill テンプレートから worktree/branch の直接判定ロジックが除去されている
6. `flow get prompt impl.review-mode` が新しい3択を返す
7. `flow get prompt impl.confirmation` が新しい4択を返す
8. `flow get prompt finalize.mode` の choice に description が含まれる

## Open Questions

- (なし)
