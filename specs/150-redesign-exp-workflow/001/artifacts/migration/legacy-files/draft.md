# Draft: experimental workflow 再設計

**開発種別:** リファクタリング + 機能改善

**目的:** experimental workflow を常駐ルールではなくコマンドと skill 中心で運用できるよう再設計する。CLAUDE.md のタスク管理セクション（約30行の MUST ルール）を skill に移行し、workflow コマンド体系を flow.js と同じ dispatcher パターンに統一する。

## 背景

現在の `experimental/workflow/board.js` は GitHub Projects API を使った board/issue 管理ツール（計565行）だが、以下の課題がある：

- CLAUDE.md に約30行の MUST ルールが常駐し、トークンを消費している
- CLI の構造が flow.js の dispatcher パターンと異なり、統一性がない
- `to-issue` コマンド名が publish という概念と一致していない
- source/publish の言語設定が config.json に統合されていない
- skill 化されておらず、ルールの揺れが発生しやすい

## Q&A

### Q1: スコープの優先順位
**Q:** Issue の全項目を1つの spec で進めるか、段階的に分割するか？
**A:** 全体を1つの spec で進める。

### Q2: CLI 再編の後方互換性
**Q:** board.js → workflow.js の移行方針は？
**A:** 一括置き換え。board.js を削除し workflow.js に完全移行。CLAUDE.md のルールも同時に更新する（alpha版ポリシーに沿う）。

### Q3: config.json の設定追加
**Q:** `experimental.workflow` の設定追加に config 検証も含めるか？
**A:** config.json フィールド追加 + types.js で検証も含める。

### Q4: board 登録仕様
**Q:** 新規登録を全て Ideas に固定するか？
**A:** `--status` オプションは残しつつデフォルトを Ideas にする。`--category` オプションで分類タグを指定できるようにする。分類は RESEARCH, BUG, ENHANCE, OTHER の4種。指定時はタイトルに `[分類]` が付与される。未指定の場合はタグなし。

### Q5: src/ 共通関数の利用範囲
**Q:** experimental から src/ の関数を利用するだけか、src/ への追加も許可するか？
**A:** 必要に応じて src/lib/ に汎用関数を追加してよい（プロジェクト非依存であること）。

### Q6: skill 化の方針
**Q:** skill のトリガー条件は？
**A:** 2つのトリガーを持つ。(1) ユーザーが `/sdd-forge.exp.workflow` を明示的に呼んだ場合に起動する。(2) skill の description に TRIGGER キーワード（「ボードに追加」「タスク化」「メモしておいて」「issue にして」等）を記載し、Claude Code のスキルマッチングにより自動提案される。ユーザーが提案を無視した場合は何もしない。

### Q7: テスト戦略
**Q:** テストの粒度は？
**A:** ユニットテストとコマンドレベル E2E テストの両方を書く。対象範囲の詳細は spec で定義する。

## 変更の影響範囲

### 変更の影響を受ける領域
- CLI エントリポイント — board.js が workflow.js に置き換わる
- config スキーマ — `experimental.workflow` セクションが追加される
- config 検証 — types.js で新フィールドの検証が必要
- 共通関数 — 必要に応じて src/lib/ に汎用関数を追加する
- CLAUDE.md — タスク管理セクションの MUST ルールが skill に移行される
- skill — `sdd-forge.exp.workflow` が新設される
- upgrade コマンド — `experimental.workflow.enable` 時に skill 配置ロジックが追加される
- テスト — ユニットテスト + E2E テストが追加される

### 既存機能への影響
- CLAUDE.md のタスク管理セクション（「ボード操作は `node experimental/workflow/board.js` を使うこと」以下約30行）は skill に移行され、CLAUDE.md からは削除される
- `to-issue` → `publish` の置き換えにより、ボード操作の既存ワークフローは新コマンドで実行する必要がある
- config.json に新フィールドが増えるが、既存フィールドには影響なし
- `experimental/AGENTS.md` の workflow 関連記述も新しいパスに更新が必要
- 既存の `experimental/tests/board-validation.test.js` は新しい構造に合わせて更新が必要

## 要件の優先順位

1. **P0（必須）**: CLI 再編（board.js → workflow.js、dispatcher 化、コマンド体系変更）
2. **P0（必須）**: config.json への `experimental.workflow` 追加 + types.js 検証
3. **P0（必須）**: publish コマンド（to-issue の置き換え、翻訳仕様）
4. **P1（重要）**: board 登録仕様の変更（デフォルト Ideas、分類タグ）
5. **P1（重要）**: skill 化（CLAUDE.md ルールの移行、sdd-forge.exp.workflow 新設）
6. **P1（重要）**: upgrade コマンドへの skill 配置ロジック追加
7. **P2（望ましい）**: src/lib/ への汎用関数追加
8. **P2（望ましい）**: テスト（ユニット + E2E）

## 制約事項

- alpha版ポリシーにより後方互換は不要
- src/ に追加する関数はプロジェクト非依存であること
- 外部依存は追加しない（Node.js 組み込みモジュールのみ）
- `experimental.workflow.enable` が false またはフィールド未設定の場合: (1) `sdd-forge upgrade` は workflow skill を配置しない、(2) `workflow.js` コマンド自体は実行可能だが config 未設定のエラーメッセージを返す

## 移行手順

alpha版ポリシーにより後方互換は不要だが、以下の順序で移行する：
1. `experimental/workflow.js` と新しい lib/ を作成する
2. CLAUDE.md のタスク管理セクションの内容を skill ファイルに移行する
3. CLAUDE.md のタスク管理セクションを新コマンド体系に更新する（skill 名の記載 + `workflow.js` のサブコマンド一覧）
4. `experimental/AGENTS.md` の workflow 関連記述を新パスに更新する
5. 既存テストを新構造に合わせて更新する
6. 旧 `board.js` を削除する

- [x] User approved this draft
