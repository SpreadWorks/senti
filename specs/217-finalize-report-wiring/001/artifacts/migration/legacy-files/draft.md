# Draft: 217-finalize-report-wiring

**開発種別:** bugfix
**目的:** finalize 完了後の Report 表示指示が、prompt のみに配線され skill テンプレート・envelope に届かない場合に見落とされる問題を解消する。

## 要件 (優先度順)

1. **[最優先] skill テンプレートに Report 表示指示を配線する**
   skill を直接読んで finalize を実行する経路 (dispatcher の prompt を経由しない経路) でも、Report 表示指示 (finalize 完了後に `sdd-forge flow report show` を実行し stdout を fenced code block で表示する旨) が AI に届くこと。検証: 当該 skill ファイルに「`sdd-forge flow report show`」という文字列が 1 箇所以上存在すること。

2. **[次点] finalize 成功 envelope に次コマンドの機械可読な hint を埋め込む**
   finalize 成功時の envelope の `data` 配下に、値が `"sdd-forge flow report show"` に完全一致する専用フィールドが存在すること。フィールド名は `nextCommand` とする。失敗系 envelope (preflight 失敗 / merge 失敗) および dry-run 実行時の envelope には当該フィールドを付与しないこと。検証: 成功 envelope の JSON に対して `data.nextCommand === "sdd-forge flow report show"` が真となり、他の result ケースでは当該プロパティが存在しないこと。

3. **[付随] 上記 1, 2 を検証する自動テスト**
   条件: 要件 1 で追加した skill の必須文言、または要件 2 で追加した envelope フィールドが将来の編集で失われた場合。
   期待動作: プロジェクトの自動テスト (`npm test` の対象範囲) が非ゼロ終了コードで失敗し、該当要件名および欠落内容を含むエラーメッセージを標準出力または標準エラーに出力すること。

## Scope Verification
- In scope:
  - 上記要件 1, 2, 3。
  - `sdd-forge upgrade` による配布 (skill テンプレート変更のため)。
- Out of scope:
  - dispatcher のステップ配列そのものに Report 表示ステップを追加する強化策 (既存配列への侵襲が大きい)。
  - Report 本文のフォーマット変更。
  - dispatcher の prompt (既に正しく指示されている) の文言変更。
  - 失敗系 envelope (preflight/merge 失敗, dry-run) に対する hint 付与。

## Impact on Existing Features
- 影響ありの既存機能:
  - finalize 成功 envelope の schema: フィールド追加 (既存フィールドは不変)。外部 consumer は存在しないため実質影響なし。
  - `sdd-forge.flow` skill テンプレート: MUST 行が増える。`sdd-forge upgrade` で配布される。
- 影響なし:
  - dispatcher (`flow get next-action`) の返却 prompt の既存文言と挙動。
  - 他の `flow run *` コマンドの envelope。
  - merge/docs-commit 以降のステップ遷移。

## Q&A
- Q: なぜ prompt 側の既存指示を残したまま、複数経路に冗長配線するのか？
  - 推奨: 独立した AI 参照経路 (skill テンプレート / dispatcher prompt / envelope データ) のいずれか 1 つからでも指示が届く defense in depth。
  - 根拠 (3) 既存コードパターン: Issue #225 が具体的に報告する通り、prompt のみの配線だと dispatcher を経由しない経路 (skill を直接読む経路) で指示が失われた実績がある。冗長配線は既存 Issue #212 の CLI 基盤側実装に続くフォローアップ方針。
  - 根拠 (2) guardrail: 本プロジェクトの guardrail 「Proactively Raise Related Implications」に沿い、単一経路配線の盲点を能動的に塞ぐ。
- Q: envelope の hint を成功時のみに限定する理由は？
  - 推奨: finalize 成功時のみに hint を付与する。
  - 根拠 (3) 既存コードパターン: Report ファイルの生成は finalize の成功経路でのみ発生する。失敗・dry-run 時に Report 表示コマンドを hint すると、Report 未生成/空の状態を指してしまい誤誘導になる。
- Q: skill テンプレートへの追記は既存のどの節と関連付けるか？
  - 推奨: 既存の Worktree boundary 節の「cwd 復元」MUST 行の直後に追記する。
  - 根拠 (1) project docs / (3) 既存コードパターン: 現行 SKILL.md の Worktree boundary 節には「finalize 完了後に `cd <mainRepoPath>` で作業ディレクトリを復元せよ」という MUST が既にある。cwd 復元は Report 表示の前提条件 (Report 表示コマンドは main repo 内のポインタを参照する) であり、論理順序として直後配置が最も自然。

## Open Questions
-

## User Approval
- [x] User approved this draft (autoApprove)
- Confirmed at: 2026-04-23
- Notes: auto モード自動承認。Issue #225 の本文に沿って作成。
