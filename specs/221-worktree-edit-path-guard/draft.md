# Draft: 221-worktree-edit-path-guard

**開発種別:** docs
**目的:** active worktree flow 中に AI が main repo の絶対パスを Edit/Write に渡して境界違反を起こすリスクを、SDD flow skill の Worktree boundary 節に MUST 行を追加することで防ぐ。

## Scope Verification
- In scope (優先度順):
  - **P1 (必須):** flow skill の Worktree boundary セクションに、「active worktree flow 中は Edit/Write ツールのファイルパスに main repo の絶対パスを使用してはならない」旨の MUST 行を追加
  - **P1 (必須):** 同 MUST 行に、許可される代替手段（worktree cwd からの相対パス / `sdd-forge flow get resolve-context` から得た worktreePath 配下の絶対パス）を明示
  - **P2 (望ましい):** skill template が変更された際、上記 P1 の MUST 文言が skill template から欠落していないことを CI / テストで検出できるようにする。合格条件:
    - `npm test` を実行した際、追加された MUST 行を表す特徴キーワード (例: 「main repo の絶対パス」「worktreePath」) が template に含まれていない場合、テストが fail する
    - テストは 1 ファイル・assert 5 件以内に抑える
- Out of scope:
  - 検査ヘルパー CLI の追加
  - Claude Code ツール層の自動パス書き換え
  - 過去 spec の遡及調査
  - Worktree boundary 節以外の文書への波及

## Impact on Existing Features
- 影響ありの既存機能:
  - `sdd-forge upgrade` 実行後のユーザープロジェクトで SKILL.md が更新され、以降の worktree flow における AI の挙動に追加の MUST 制約が課される
- 影響なし:
  - CLI の runtime 挙動 (サブコマンド出力 / flow state schema / agent invocation / gate / review) は一切変更しない
  - 既存 Worktree boundary 節の他の MUST (cd 禁止 / git stash 等禁止 / baseline 比較の detached worktree 指示) は保持される

## Q&A
- Q1: 実装方針 (MUST 行のみ / 検査ヘルパー併設 / ヘルパー強制) のどれか?
  - A: MUST 行のみ追加。Issue 本文の判断と一致。ヘルパー追加は AI の自発的呼び出しに依存するため MUST 文言と実効性が同等で、CLI 面積のみ増える。
- Q2: テスト戦略は?
  - A: 追加 MUST 文言に対する軽量な回帰テストを 1 件追加。skill template 資産の汎用検査パターン (既存 partial の同種テストと同水準) に倣う。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: Q1, Q2 のいずれも推奨案 [1] が選択された。
