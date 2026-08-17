# Feature Specification: 185-scan-dryrun-summary

**Feature Branch**: `feature/185-scan-dryrun-summary`
**Created**: 2026-04-17
**Status**: Ready for review
**Input**: Issue #164

## Goal

`sdd-forge docs scan --dry-run` の出力を、analysis 全体の巨大 JSON から「カテゴリ → エントリ件数」の単層 JSON summary に変更する。これにより CI / テストスクリプトでのカテゴリ別件数検証が容易になり、`--dry-run` と `--stdout` の役割重複を解消する。

## Scope

- `sdd-forge docs scan` サブコマンドの `--dry-run` フラグの stdout 出力フォーマット変更
- `--stdout` フラグの出力フォーマット維持（リグレッション防止）
- `--stdout` と `--dry-run` 併用時の優先順位の明文化と実装
- プリセット作成ガイドの該当箇所への summary 出力に関する記述追加（ja / en）
- 上記変更に対するユニットテスト追加

## Out of Scope

- 人間向けテキスト整形出力（テーブル形式・色付け等）の追加
- `--summary` 等の新フラグ追加
- scan 以外のサブコマンド（init, data, text, readme, agents, translate）の `--dry-run` 出力形式変更
- `--dry-run` 詳細出力に依存していた外部スクリプト向けのアダプター層実装

## Clarifications (Q&A)

- Q: `--dry-run` と `--stdout` の役割をどう分けるか
  - A: `--stdout` を全 analysis JSON 出力、`--dry-run` を summary 出力とする。新フラグは追加しない。

- Q: summary の構造は
  - A: カテゴリ名をキー、エントリ件数（整数）を値とする単層 JSON オブジェクト。`analyzedAt` 等のメタは含めない。

- Q: scan DataSource が登録済みかつ 0 件のカテゴリは出力に含めるか
  - A: 含める。値は `0`。「DataSource が存在しない」と「scan 済みだが 0 件」を区別するため。

- Q: `--stdout --dry-run` を同時指定した場合
  - A: `--stdout` を優先し、全 analysis JSON を出力する。

- Q: scan 以外のサブコマンドの `--dry-run` 挙動への影響
  - A: 変更しない。本 spec のスコープは scan サブコマンドのみ。

## Alternatives Considered

- 案 B: `--summary` フラグを新設して既存挙動を維持
  - 棄却理由: alpha 版ポリシー「後方互換コードは書かない」に反し、`--dry-run` と `--stdout` のフラグ重複が解消されない。
- 案 C: `--dry-run` をデフォルト summary、`--full` を追加
  - 棄却理由: `--stdout` が既に「全 analysis JSON 出力」役割を担っており、`--full` は重複。
- 採用案: `--stdout` を全 JSON、`--dry-run` を summary に役割分担し、新フラグを追加しない。

## Why This Approach

- `--dry-run` と `--stdout` が同義の分岐になっている現状を解消し、各フラグに固有の役割を持たせることでインターフェースが直交する。
- 新フラグを追加しないため、CLI 表面が増えず alpha 版ポリシーに沿う。
- summary 出力は CI / テスト用途で機械可読。詳細 JSON が必要な場面は `--stdout` で従来どおり取得可能。
- 破壊的変更を許容できるのは alpha 期間中だからこそ。後方互換のまま放置すると重複が固定化する。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-17
- Notes: autoApprove mode

## Requirements

優先順位: P0 = 本 spec の本質、P1 = 役割整合性、P2 = ドキュメント整合性。

- **R1 (P0)**: `sdd-forge docs scan --dry-run` 実行時、stdout に「カテゴリ名 → エントリ件数（整数）」の単層 JSON オブジェクトのみを出力すること。analysis 全体の JSON は出力しないこと。
- **R2 (P0)**: R1 の出力に、scan DataSource が登録済みかつエントリ 0 件のカテゴリも値 `0` のキーとして含めること。
- **R3 (P0)**: R1 の実行時、analysis.json への書き込みを行わないこと。
- **R4 (P0)**: `sdd-forge docs scan --stdout` 実行時、analysis 全体の JSON を stdout に出力すること（従来挙動の維持）。
- **R5 (P1)**: `--stdout` と `--dry-run` を同時指定した場合、`--stdout` を優先し、analysis 全体の JSON を出力すること。
- **R6 (P1)**: scan 以外のサブコマンドに `--dry-run` を指定した場合、既存どおりファイル書き込みをスキップする挙動を維持し、出力形式を変更しないこと。
- **R7 (P2)**: 本 spec の実装をマージする際、プリセット作成ガイド（ja / en 両言語）の `--dry-run` 用法説明に summary 形式である旨が明記されていること。
- **R8 (P0)**: scan サブコマンドが正常終了したとき終了コード 0 を返し、エラー（不正な引数、scan 失敗等）が発生した場合は非ゼロの終了コードを返すこと（既存の終了コード契約を維持する）。

## Acceptance Criteria

- AC1: `sdd-forge docs scan --dry-run` を実行した stdout が JSON オブジェクトであり、すべての値が非負整数であること。`analyzedAt` キーが含まれないこと。
- AC2: scan DataSource が複数登録されたフィクスチャで `--dry-run` を実行したとき、エントリ 0 件のカテゴリも値 `0` でキーとして含まれること。
- AC3: `--dry-run` 実行後、analysis.json が新規作成・更新されないこと。
- AC4: `sdd-forge docs scan --stdout` の出力に `analyzedAt` フィールドが含まれ、各カテゴリが `entries` / `summary` を持つ従来構造であること。
- AC5: `--stdout` と `--dry-run` を同時指定したときの出力が AC4 と同一構造であること。
- AC6: scan 以外のサブコマンド（例: data）に `--dry-run` を指定しても、本 spec 変更前と同じ出力・挙動であること（リグレッション）。
- AC7: プリセット作成ガイド（ja / en）の `--dry-run` 説明に summary 出力に関する記述があること。
- AC8: 上記 AC1〜AC6 を検証するユニットテストが追加され、`npm test` でパスすること。
- AC9: `--dry-run` および `--stdout` の正常実行時に終了コード 0 を返すこと。不正な引数や scan 失敗時は非ゼロを返すこと（R8）。

## Test Strategy

**単体テスト**（CLI コマンド契約の formal テストとして配置）:

- AC1, AC2, AC3 → `--dry-run` の出力形式・空カテゴリ含有・file write skip を検証
- AC4 → `--stdout` 出力構造を検証（リグレッション防止）
- AC5 → `--stdout --dry-run` 併用時の優先順位を検証
- AC6 → scan 以外のサブコマンドの `--dry-run` 動作リグレッションを検証
- AC7 → ガイド文言の検証はドキュメントレビューで担保（テスト対象外）

テストフィクスチャは scan DataSource を 2 つ以上含む最小プリセットを `createTmpDir()` で構築し、片方を 0 件マッチさせて R2 を検証する。

## Migration Plan

- alpha 版（`0.1.0-alpha.N`）であり、後方互換コードは書かない方針（プロジェクト `CLAUDE.md`）。
- 影響範囲: `sdd-forge docs scan --dry-run` の stdout 出力に依存する外部 CI / スクリプト。
- 移行手順:
  1. CHANGELOG に破壊的変更として記載し、`--stdout` への置換手順を提示する
  2. 件数確認用途の利用者は無対応で済む（summary の方が扱いやすい）
  3. analysis JSON 全体が必要だった利用者は `--stdout` に置換する
- 通知: Issue #164 のクローズコメントで変更内容を周知する。

## Open Questions

なし（draft 段階で全て解消）
