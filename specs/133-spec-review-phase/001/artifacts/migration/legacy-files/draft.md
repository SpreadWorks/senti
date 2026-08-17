# Draft: 133-spec-review-phase

**開発種別**: 機能追加
**目的**: flow run review --phase spec を追加し、gate では検出できない spec の考慮漏れを AI レビューで検出・自動修正する

## Q&A

- Q1: 実装パターンは？
  - A: 既存の review.js に --phase spec の分岐を追加する（--phase test と同じアプローチ）

- Q2: spec review に渡すコンテキストの取得方法は？
  - A: review.js 内から get-context.js の searchEntries を関数として呼ぶ。現状 export されていないので export を追加する

- Q3: 出力形式は？
  - A: code review と同じ proposal 形式（review.md に指摘・修正案・APPROVED/REJECTED を出力）

- Q4: 自動修正ループの制御は？
  - A: コマンド側（review.js）で反復ループまで行い、完了/上限到達を返す。スキルはコマンドを1回呼ぶだけ

- Q5: spec の自動修正は誰が行うか？
  - A: review.js 内の AI 呼び出しで修正版 spec を生成し、ファイルに書き戻す。レビュー → 指摘 → 修正 → 再レビューが1コマンド内で完結

- Q6: test review との共通化は？
  - A: 既存の test review（runTestReview）も「レビュー → 修正 → 再レビュー」のループを持つ。このループパターンを共通化し、spec review と test review の両方で使う。具体的には「指摘検出 → 修正適用 → 再検出」のループ制御を共通関数に抽出する

## 要件まとめ

優先順位順:

1. When: review.js に「レビュー → 修正 → 再レビュー」の反復ループがある場合、test review と spec review で共通利用できる関数として抽出する。ループは「指摘検出 → 修正適用 → 再検出」を上限回数まで繰り返し、指摘なし or 上限到達で終了する
2. When: `flow run review --phase spec` が実行された場合、review.js は spec.md とコードベースコンテキスト（contextSearch 結果）を AI に渡し、考慮漏れを proposal 形式で review.md に出力する
3. When: spec review で APPROVED な指摘が存在する場合、review.js は AI に修正版 spec を生成させ spec.md に書き戻し、共通ループで再レビューする（上限 3回）
4. When: review.js が spec review のコンテキストを取得する場合、get-context.js から export された loadAnalysisEntries / contextSearch を関数呼び出しする
5. When: flow-plan スキルで gate spec が PASS した場合、spec review を実行し、完了後に gate spec を再実行して guardrail 違反がないことを再検証する

## 既存機能への影響

- review.js: 既存の test review ループを共通関数に抽出。test review の動作は変わらない（リファクタのみ）。--phase spec 分岐を追加
- get-context.js: loadAnalysisEntries / contextSearch を export 追加。既存の呼び出し元に影響なし（searchEntries は export 済み）
- run-review.js: phase=spec のパース処理を追加
- registry.js: review エントリの help テキストに --phase spec を追記
- flow-plan SKILL.md: gate 後に spec review ステップを挿入

## テスト戦略

- specs/133/tests/ に spec review の動作確認テストを配置
- review.js の --phase spec 分岐が正しくルーティングされることを検証
- searchEntries の export が既存テストを壊さないことを確認（既存テスト全通過）

- [x] User approved this draft
- Confirmed at: 2026-04-03
- Notes: 共通ループ抽出を追加後に承認
