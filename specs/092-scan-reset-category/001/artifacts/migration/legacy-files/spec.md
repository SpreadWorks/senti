# Feature Specification: 092-scan-reset-category

**Feature Branch**: `feature/092-scan-reset-category`
**Created**: 2026-03-27
**Status**: Draft
**Input**: GitHub Issue #22

## Goal

`sdd-forge scan --reset` オプションを追加し、analysis.json の指定カテゴリ（または全カテゴリ）のエントリの hash をクリアする。これにより、次回の scan 実行時にそのカテゴリのファイルが再パースされる。

### Why this approach

DataSource のバグ修正やプリセット変更後、修正を反映するには analysis.json の再生成が必要だが、全体再生成は enrich のコスト（数時間）を伴う。hash のみをクリアすることで、scan が変更対象だけ再パースし、影響範囲を最小限に抑えられる。

## Scope

- scan.js に `--reset` オプションを追加
- analysis.json の読み込み → 指定カテゴリの hash クリア → 保存
- scan 自体は実行しない（hash クリアのみで終了）
- ヘルプテキストの更新
- i18n 対応（locale ファイル）

## Out of Scope

- enrich フィールド（`enrich.processedAt`, `summary`, `detail`）のクリア
- analysis.json のスキーマ正規化レイヤー（ボード 83f6 で別途検討）
- `--reset` と他のオプション（`--stdout`, `--dry-run`）の組み合わせ

## Clarifications (Q&A)

- Q: `--reset` 実行時に scan も続行するか？
  - A: しない。hash クリアのみ。`sdd-forge build` で scan を含むパイプライン全体が再実行される。
- Q: オプション名は `--reset-category` や `--reset-hash` でなく `--reset` にする理由は？
  - A: hash は実装詳細でユーザーに見せる概念ではない。`--reset-category` は引数なし時（全カテゴリリセット）に不自然。scan コマンドのコンテキストで `--reset` が最も直感的。
- Q: 引数省略の検出方法は？
  - A: `process.argv.includes("--reset")` で存在を検出し、`parseArgs` で値を取得。値がなければ全カテゴリ扱い。
- Q: enrich フィールドもクリアするか？
  - A: しない。ただし scan 再パース時にエントリが丸ごと置き換わるため、結果的に enrich も再実行される。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-28
- Notes: Draft Q&A を経て全要件合意済み

## Requirements

優先度: P1（コア機能） > P2（表示・UX） > P3（ヘルプ・i18n）

### P1: コア機能

1. `sdd-forge scan --reset` を実行した場合、analysis.json の全カテゴリのエントリの hash を null に設定して保存する
2. `sdd-forge scan --reset <categories>` を実行した場合、カンマ区切りで指定されたカテゴリのみ hash をクリアする
3. `--reset` を指定した場合、hash クリア後に scan を実行せず終了する
4. `--reset` で hash をクリアする際、enrich フィールド（`enrich.processedAt`, `summary`, `detail`, `chapter`, `role`）は変更しない

### P2: 表示・エッジケース

5. hash クリア後、各カテゴリ名と件数を stderr に表示する（例: `reset: controllers (12 entries)`）
6. 最後に合計を stderr に表示する（例: `total: 20 entries reset in 2 categories`）
7. 存在しないカテゴリが指定された場合、stderr に警告を出力し exit code 0 で終了する。これはコマンドの失敗ではなく no-op（操作対象なしの正常完了）である。ガードレール「終了コードの規約」の「失敗」には該当しない。根拠: 本プロジェクトの exit code 1 は「操作を続行できない致命的エラー」（不明コマンド、必須ファイル不在、ビルドエラー等）にのみ使用されており、no-op を非ゼロで返すコマンドは存在しない。
8. analysis.json が存在しない場合、stderr にメッセージを出力し exit code 0 で終了する。これも no-op であり失敗ではない。根拠: 要件7と同一。

### P3: ヘルプ・i18n

9. ヘルプテキスト（`printHelp()`）に `--reset` オプションの説明を追加する
10. i18n locale ファイル（en, ja）にヘルプテキストを追加する

## Acceptance Criteria

1. `sdd-forge scan --reset` 実行後、analysis.json の全エントリの hash が null になっている
2. `sdd-forge scan --reset controllers` 実行後、controllers カテゴリのみ hash が null で他は変更されない
3. `sdd-forge scan --reset controllers,models` 実行後、両カテゴリの hash が null で他は変更されない
4. 存在しないカテゴリ指定時に警告が表示され、exit code 0 で終了する
5. analysis.json がない状態で実行した場合、メッセージが表示され exit code 0 で終了する
6. `sdd-forge scan --reset` の後に `sdd-forge scan` を実行すると、リセットされたカテゴリのエントリが再パースされる
7. `sdd-forge scan -h` で `--reset` オプションが表示される

## Open Questions

（なし）
