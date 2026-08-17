# Draft: scan --dry-run の出力を summary に変更

**開発種別:** ENHANCE（破壊的変更を含む）

**目的:** `sdd-forge docs scan --dry-run` の出力を「カテゴリ → エントリ件数」の summary JSON に変更し、CI / テストスクリプトでの件数検証を容易にする。同時に `--dry-run` と `--stdout` の役割重複を解消する。

## Requirements（優先順位順）

| # | 優先度 | トリガー条件 | 期待される動作 |
|---|---|---|---|
| R1 | P0 | `sdd-forge docs scan --dry-run` 実行時 | stdout に「カテゴリ名 → エントリ件数（整数）」の単層 JSON オブジェクトのみを出力する。analysis 全体の JSON は出力しない。 |
| R2 | P0 | R1 実行時、scan DataSource が登録済みかつエントリ 0 件のカテゴリが存在する | そのカテゴリ名もキーとして値 `0` を出力に含める。 |
| R3 | P0 | R1 実行時 | analysis.json への書き込みは行わない（既存の dry-run 動作を維持）。 |
| R4 | P0 | `sdd-forge docs scan --stdout` 実行時 | analysis 全体の JSON を stdout に出力する（従来挙動を維持）。 |
| R5 | P1 | `--stdout` と `--dry-run` を同時指定した場合 | `--stdout` を優先し、analysis 全体の JSON を出力する。 |
| R6 | P1 | scan 以外のサブコマンド（init, data, text 等）に `--dry-run` を指定した場合 | 既存挙動どおりファイル書き込みをスキップする。出力形式は変更しない。 |
| R7 | P2 | プリセット作成ガイドのドキュメント | `--dry-run` 出力が summary 形式である旨を明記する（ja/en 両言語）。 |

## Q&A

### Q1: ユーザー意図の解釈
**A:** Issue #164 の「`--dry-run` を summary 化（破壊的変更）」を採用。
- 根拠（issue 本文）: Issue #164 の「採用方針」セクション
- 根拠（ユーザー承認）: 本フロー Q1 で確認済み

### Q2: `--dry-run` と `--stdout` の役割分担
**A:** `--stdout` = 全 analysis JSON、`--dry-run` = summary。新フラグ `--summary` は追加しない。
- 根拠（既存挙動）: 現状 `--dry-run` と `--stdout` がほぼ同義の分岐になっている
- 根拠（プロジェクトルール）: `CLAUDE.md` の「alpha 版ポリシー: 後方互換コードは書かない」

### Q3: summary の構造
**A:** カテゴリ名 → エントリ件数（整数）の単層 JSON。メタフィールドは含めない。
- 根拠（issue 本文）: Issue #164 の出力例
- 根拠（用途）: CI から件数を機械的に検証する用途

### Q4: 空カテゴリの扱い
**A:** scan DataSource が登録済みなら 0 件でもキーとして出す。
- 根拠（issue 本文）: Issue #164「実装上の注意」で「空カテゴリもキーとして出す」と明記
- 根拠（用途）: CI で「特定カテゴリが 0 件になったら失敗」を判定するため、欠落と 0 件の区別が必要

### Q5: `--stdout --dry-run` 併用時
**A:** `--stdout` を優先。
- 根拠（既存挙動）: `--stdout` は spec 003 以前から「全データ stdout 出力」として確立した役割
- 根拠（設計判断）: 明示的な全データ要求を補助的な summary より優先する方が一貫している

### Q6: 他サブコマンドへの影響
**A:** scan 以外のサブコマンドの dryRun 伝搬挙動は変更しない（R6）。
- 根拠（spec 003）: 既存 spec で「dryRun = ファイル書き込みスキップ」の意味で全サブコマンドに伝搬している
- 根拠（スコープ管理）: Issue #164 が scan のみを対象としているため

### Q7: 既存テスト・ドキュメントへの影響
**A:**
- 根拠（既存コード調査）: 事前 grep で `scan --dry-run` 出力構造に依存するテストは存在しない
- 根拠（既存ドキュメント）: プリセット作成ガイドでの `--dry-run` 用法は「ファイル収集確認」のみで、出力詳細に触れていない → R7 で文言追記

### Q8: スコープ外
**A:**
- 人間向けテキスト整形出力（別 spec）
- `--summary` フラグ追加（Q2 の根拠で採用しない）
- scan 以外のサブコマンドの dryRun 出力形式変更（Q6 のスコープ管理）
- `--dry-run` 詳細出力に依存する外部コードのアダプター実装（移行計画参照）

### Q9: テスト戦略
**A:**
- ユニットテスト: `--dry-run` 出力が `{ categoryName: integer }` 形式であること
- ユニットテスト: `--stdout` 出力が従来どおり `analyzedAt` を含む全 analysis JSON であること（リグレッション防止）
- ユニットテスト: 0 件カテゴリがキーとして含まれること（R2 の検証）
- ユニットテスト: `--stdout --dry-run` 併用時に R5 の優先順位が守られること
- 配置: CLI コマンド契約テストのため formal テストとして配置
- 根拠（プロジェクトルール）: `CLAUDE.md` の「テストを通すためにテストコードを修正してはならない」

### Q10: 代替案検討
**A:**
- 案 B: `--summary` フラグ新設 → フラグ重複が残るため棄却（Q2 alpha ポリシー根拠）
- 案 C: `--dry-run` デフォルト summary + `--full` 追加 → `--stdout` が既存役割を担うため重複
- 採用案: `--stdout` 全 JSON / `--dry-run` summary（R1, R4）

### Q11: 将来拡張性
**A:** summary の値を将来 `{ count, ... }` のオブジェクトに拡張する場合も既存キーを保ったまま追加可能。`--summary=text` 等の整形フラグも独立に追加可能。
- 根拠（設計判断）: 単層 JSON は OpenAPI 等の値型拡張パターン（プリミティブ → オブジェクト）に対応しやすい

### Q12: 移行計画（破壊的変更）
**A:**
- 根拠（プロジェクトルール）: `CLAUDE.md` の「alpha 版ポリシー: 後方互換コードは書かない」
- 影響範囲: `sdd-forge docs scan --dry-run` の stdout 出力に依存する外部コード／CI スクリプト
- 移行手順:
  1. リリースノート（CHANGELOG）に破壊的変更として明記し、`--stdout` への置換手順を提示
  2. 件数確認用途の利用者は無対応で済む（summary の方が扱いやすい）
  3. analysis JSON 全体が必要だった利用者は `--stdout` に置換
- 通知: Issue #164 のクローズコメントで変更内容を周知

## User Confirmation

- [x] User approved this draft (autoApprove)
- 承認日: 2026-04-17
