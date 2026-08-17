# Draft: 219-fix-review-envelope-mismatch

**開発種別:** bugfix
**目的:** `sdd-forge flow run review` が返す envelope の提案カウントと、spec ディレクトリに書き出される review 結果ファイルの内容を、全ての実行経路において必ず一致させる。

## Scope Verification
- In scope (優先度順):
  - **P1 — 不整合解消（必須）:** When impl-phase review の実行が完了した時、review 結果ファイルは当該実行によって必ず上書きされ、過去実行の内容が残留してはならない。
  - **P2 — 不整合解消（必須）:** When impl-phase review の実行後に採用可能な提案が 0 件となった時、review 結果ファイル本文には「採用可能な提案は 0 件である」旨を示す固定文字列が 1 行以上含まれていること（envelope の `approved: 0` と本文が対応する）。
  - **P3 — 不整合解消（必須）:** When envelope の `proposalCount` / `approved` / `rejected` が N 件を報告した時、review 結果ファイル本文に含まれる提案エントリ数は `approved + rejected` と等しいこと。
  - **P4 — 派生バグ fix（同梱）:** When scope フィルタによって一部の提案が除外された時、最終検証フェーズに渡す提案集合は除外後のものとし、最終検証フェーズが出力する verdict リストと提案リストの位置順序が 1 対 1 で対応すること。
  - **P5 — 検証（必須）:** 上記 P1〜P4 の振る舞いは、外部プロセス（AI CLI、git、ネットワーク）を呼び出さない自動テストで検証可能であること。
- Out of scope:
  - envelope への `reviewedFiles` / `inScopeFiles` 等の新フィールド追加
  - AI 生成 prompt 側の in-scope 指示強化（AI に scope 意識を持たせる改善）
  - 既にコミット済みの過去 review 結果ファイルを git 履歴から事後クリーンアップする処理
  - test phase / spec phase の review 動作（本 spec は impl-phase review のみ対象）

## Impact on Existing Features
- 影響ありの既存機能:
  - impl-phase の review 実行: 採用可能な提案が 0 件の場合に出力される review 結果ファイル本文が、空テンプレートから「提案なし」を明示する本文に変わる
  - impl-phase の review 実行: 提案が parse 失敗または scope フィルタで全除外されたケースで、従来は結果ファイルが書き換えられず過去内容が残留していたが、今後は現在実行分の結果で必ず上書きされる
  - envelope の外形（キー名・型）は不変（後方互換）
- 影響なし:
  - test phase review、spec phase review
  - draft gate、impl gate
  - flow-state の step / metrics 構造
  - CLI コマンド名・オプション

## Q&A
- Q1: 修正スコープをどこまで含めるか。
  - A: P1/P2（メイン）+ P3（final phase の index ずれ fix）。envelope 拡張と AI prompt 強化は除外。
  - 根拠: Issue #236 本文で提示された 3 候補のうち「envelope と review 結果ファイルの一致化」は Single Responsibility の観点で単一 spec に収まる。一方、派生バグ（P3）は同じレビュー経路上で verdict が別提案に誤紐付く根因であり、P1/P2 と切り離すとメイン修正の効果を打ち消す回帰を招く恐れがあるため同梱する。envelope 拡張は skill 側の利用形態が未確定のため別 spec とする。
- Q2: テスト方針は unit / 統合のどちらを採るか。
  - A: 純粋関数抽出による unit テストのみ。AI 呼び出しを含む統合テストは追加しない。
  - 根拠: プロジェクト CLAUDE.md「AI 実行を伴うテスト」節により、AI 呼び出しを含むテストは `tests/agent/` 配下の別枠扱いで `npm test` から除外される。本 spec の検証対象はロジック層であり、振る舞いは AI 出力を与えれば決定論的に定まるため、stub を介さず純関数テストで十分。
- Q3: 採用可能な提案が 0 件の場合、review 結果ファイル本文に入れる「提案なし」表示の要件は。
  - A: ヘッダ行に加えて、提案が 0 件である旨を示す固定文字列の本文行を最低 1 行含めること。空テンプレート（ヘッダ行のみ）は許容しない。
  - 根拠: 本 issue の再現例では「ヘッダのみの空本文」と「過去実行の残留提案」が見た目上区別しづらく、skill / user が envelope と照合せずに finalize に進んだ際の誤判断の要因となった。本文に 0 件を明示する固定行を必須化すれば、envelope 参照なしでも現在の状態が確定する。

## Open Questions
- なし

## User Approval
- [x] User approved this draft
- Confirmed at: 2026-04-23
- Notes: scope = P1+P2+P3 (option [2] of Q1); tests = unit only (option [1] of Q2)
