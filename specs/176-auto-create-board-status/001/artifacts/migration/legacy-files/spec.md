# Feature Specification: 176-auto-create-board-status

**Feature Branch**: `feature/176-auto-create-board-status`
**Created**: 2026-04-14
**Status**: Draft
**Input**: GitHub Issue #147

## Status Name Reference

このドキュメントで言及するボードステータスの正式名:

| 場面                          | ステータス名 |
| ----------------------------- | ------------ |
| draft 追加時 (default)        | `Ideas`      |
| issue 化（publish）後の遷移先 | `Todo`       |

以降、本文では「draft 用 status」「publish 後 status」と呼称する。

## Goal

`experimental/workflow` の `add` / `update` / `publish` コマンドが、GitHub Projects ボードに必要な status (draft 用 / publish 後) が事前に存在しない場合に `status not found` で失敗する問題を解消する。新規ボードでも追加セットアップなしでボード操作 CLI が動作する状態にする。

## Scope

- `add` / `update` 実行時、参照される status (デフォルトは draft 用 status、`--status` で任意指定可) が存在しなければ自動作成してから処理を続行する
- `publish` 実行時、publish 後 status が存在しなければ自動作成してから処理を続行する
- ボード操作 CLI 側で status option 作成を行うための手段を整備する

## Out of Scope

- Status フィールド自体（"Status" という SingleSelectField）が存在しない場合の自動作成。フィールド構造の変更は影響範囲が大きいため。
- 別途 `init` サブコマンドの提供。
- 既存 status の名称変更・削除・並び替え。

## Clarifications (Q&A)

- Q1: 対応アプローチ（自動作成 vs init コマンド）
  - A1: オンデマンド自動作成を採用する。Issue #147 で第一に挙げられた期待動作であり、新規ボードでも追加コマンドなしで動作するためユーザー摩擦が最小。
- Q2: 自動作成の対象範囲
  - A2: 参照される status を全て自動作成する（`--status` で指定された任意の値も対象）。「無ければ作る」原則を一貫して適用するほうが特殊ケースが増えない。
- Q3: Status フィールド自体が存在しない場合
  - A3: エラーで停止する。ボード構造を意図せず変更するリスクを避けるため、フィールド自体の作成はスコープ外。
- Q4: テスト戦略
  - A4: 既存 `experimental/` テストのスタイル（構造的チェック中心）に合わせる。

## Alternatives Considered

- **別途 `init` サブコマンドを提供**: 明示的な初期化フローを設けることで動作が予測しやすいが、ユーザーが追加手順を踏む必要があり Issue の期待動作と乖離する。
- **Status フィールドごと自動作成**: 完全な「ゼロ設定」を実現できるが、ボード構造を意図せず変更してしまうリスクがあり破壊的。
- **依存注入と mock テスト**: テストカバレッジは厚くなるが、既存 `experimental/` テストの軽量さと整合せず、保守コストが上がる。

## Why This Approach

- Issue #147 の "Expected Behavior" が第一にオンデマンド自動作成を挙げており、ユーザー期待に沿う
- 既存ボードでは追加処理が走らないため、現行ユーザーへの影響が無い
- フィールド構造の変更は破壊的になり得るため、option 作成のみに限定すれば安全
- 別 `init` コマンドを後から追加することも可能で、将来の選択肢を狭めない

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-14
- Notes: gate spec PASS 後、ユーザー承認

## Requirements

優先度の高い順:

1. **(高) status not-found エラーの解消**: When `add` / `update` / `publish` が status を参照する時, If 該当する status option がボード上に存在しない場合, システムは当該 option を作成してから処理を続行し、コマンドは正常終了 (exit code 0) する。
2. **(高) Status フィールド自体が無い場合の安全な停止**: When ボード操作 CLI が実行され, If "Status" フィールドそのものが存在しない場合, システムはフィールドの作成や変更を一切試みず、non-zero exit code で停止する。
3. **(中) 既存ボードへの非影響**: When 参照される status が事前に存在する場合, システムは option 作成のための GraphQL 呼び出しを 0 回に保ち、現行と同じ手順で処理を完了する。
4. **(低) Status フィールド欠如時のエラー案内**: When Status フィールド欠如により停止する場合, システムはエラー出力に「フィールド名 `Status`」と「SingleSelectField である必要がある旨」を含めてユーザーが対処方法を判断できるようにする。

## Acceptance Criteria

| # | 前提 | 操作 | 期待結果 |
| - | ---- | ---- | -------- |
| AC1 | 新規 ProjectV2 ボード（Status フィールドのみ存在し option 0 件、または draft 用 / publish 後 status のいずれかが欠如） | `add` / `publish` を実行 | 必要な status option が自動作成され、コマンドが exit code 0 で完了する |
| AC2 | draft 用 / publish 後 status が事前に揃っているボード | `add` / `publish` を実行 | option 作成のための GraphQL 呼び出しは 0 回。現行と同じ結果（item 作成 / issue 化）が得られる |
| AC3 | "Status" フィールド自体が存在しないボード | `add` / `publish` を実行 | エラーメッセージ（`Status` フィールド名 と SingleSelectField である旨を含む）が標準エラーに出力され、non-zero exit code で停止。フィールドの作成や変更は行われない |
| AC4 | Status フィールドあり、`Backlog` option なし | `add --status Backlog` を実行 | `Backlog` option が自動作成され item に割り当てられる |
| AC5 | 本 spec で追加した構造的テスト | `node tests/run.js` を実行 | 当該テストが PASS する |

## Test Strategy

- **構造的テスト**（`experimental/tests/` 配下、既存スタイルに合わせる）
  - 新たに追加する option 作成手段が graphql モジュールから export されている
  - 関数名・引数・戻り値の基本契約を確認する
- **手動検証**（実 GitHub ボードに対して実施、結果を Acceptance Criteria に沿って確認）
  - AC1: 新規ボードでの `add` / `publish`
  - AC2: 既存ボード（status 揃い）での `add` / `publish` (回帰)
  - AC3: Status フィールド未存在ボードでのエラー停止
  - AC4: 任意 `--status` 値での自動作成
- **実 GitHub API への自動テストは行わない**（既存 `experimental/` テスト方針に従う）

## Open Questions

なし
