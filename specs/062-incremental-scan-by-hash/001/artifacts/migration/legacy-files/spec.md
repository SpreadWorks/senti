# Feature Specification: 062-incremental-scan-by-hash

**Feature Branch**: `feature/062-incremental-scan-by-hash`
**Created**: 2026-03-16
**Status**: Draft
**Input**: User request

## Goal

analysis.json のハッシュフィールドを使った差分比較により、変更されたファイルだけを scan → enrich → text する仕組みを追加する。ドキュメント生成の実行時間と AI トークン消費を削減する。

## Scope

- **scan**: analysis.json 存在時にハッシュ比較で変更・新規ファイルだけ再スキャン。削除ファイルは自動除外
- **enrich**: scan の差分化により変更エントリーの enrichment が消えるため、既存レジューム機能で自動的に変更分だけ処理
- **text**: 変更エントリーの `chapter` フィールドから影響章を特定し、ディレクティブをクリアして再生成
- **build**: パイプライン全体をデフォルト差分化

## Out of Scope

- `--full` フラグの追加（analysis.json 削除で代用）
- data コマンドの差分化（data は高速なため不要）
- init / readme / agents の差分化

## Clarifications (Q&A)

- Q: git diff で比較するのか？
  - A: git に依存せずファイルハッシュ（MD5）比較を使う。uncommitted な変更も拾え、git リポジトリでないプロジェクトでも動作する。
- Q: 削除されたファイルを残さないと差分がとれなくならないか？
  - A: ならない。差分比較に必要なのは既存 analysis.json 内のハッシュと現在のファイルハッシュの比較のみ。削除済みファイルの情報は不要。
- Q: `--full` フラグは必要か？
  - A: 不要。analysis.json を削除すればフル実行と同等。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-16
- Notes: 全レイヤー差分化、--fullフラグなし

## Requirements

1. **R1: scan 差分モード**
   - analysis.json が存在する場合、既存エントリーの `hash` と現在のファイルハッシュを比較
   - ハッシュが一致するファイルはスキャンをスキップし、既存エントリーをそのまま保持
   - ハッシュが異なるファイル・新規ファイルのみ DataSource の `scan()` に渡す
   - 既存 analysis.json に存在するが現在のファイル一覧にないエントリーは除外（削除対応）
   - analysis.json が存在しない場合は従来どおりフルスキャン

2. **R2: enrich 差分処理**
   - scan の差分化により、変更エントリーの enrichment フィールド（summary/detail/chapter/role）は保持されない
   - enrich の既存レジューム機能（`!e.enriched` フィルター）がそのまま変更分だけ処理する
   - 追加実装は不要（scan 側の変更で自動的に実現）

3. **R3: text 影響章限定再生成**
   - 変更された（= 今回 enrich された）エントリーの `chapter` フィールドを収集
   - 影響章のファイルのみ text 処理対象とする
   - 影響章の `{{text}}` ディレクティブ内コンテンツをクリアしてから再生成
   - 影響のない章ファイルはスキップ

4. **R4: build パイプライン統合**
   - `sdd-forge docs build` もデフォルトで差分モードを使用
   - 各ステップに差分コンテキスト（影響章リスト等）を引き渡す

5. **R5: ログ出力**
   - 差分モード時は変更・新規・削除・スキップのファイル数をログに表示
   - enrich は既存のログ（`resuming: N already enriched, M remaining`）で対応
   - text はスキップした章・処理した章をログに表示

## Acceptance Criteria

- [ ] analysis.json が存在する状態で scan を実行すると、変更ファイルだけがスキャンされる
- [ ] 変更がないファイルの既存エントリー（enrichment 含む）が保持される
- [ ] 削除されたファイルのエントリーが analysis.json から除外される
- [ ] enrich が変更エントリーだけを AI に投げる
- [ ] text が影響章だけを再生成する
- [ ] analysis.json が存在しない場合はフルスキャンが実行される
- [ ] `sdd-forge docs build` が差分モードで動作する
- [ ] 既存テストが壊れない

## Open Questions

(none)
