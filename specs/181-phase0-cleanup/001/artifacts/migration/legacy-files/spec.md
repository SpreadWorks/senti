# Feature Specification: 181-phase0-cleanup

**Feature Branch**: `feature/181-phase0-cleanup`
**Created**: 2026-04-17
**Status**: Draft
**Input**: GitHub Issue #154 — "054d: [ENHANCE] 1877/Phase0: Small-scale cleanup"

## Goal

1877 Container 導入（Phase 1）に先行して、Container 設計判断とは独立に完了できる小規模クリーンアップ 4 件を一括で処理し、後続 Phase のレビュー差分を見通しやすくする。挙動変更を伴わないリファクタに限定する。

## Single Responsibility Rationale

表面的には 4 修正だが、共通の単一関心は **「1877 Phase 0: Container 導入前に除去すべき dead code / API ノイズの一括クリーンアップ」** である。以下の理由で 1 spec にまとめる:

- 4 修正は `.tmp/1877.md` および issue #154 で同一フェーズ（Phase 0）として事前にグルーピング済みで、独立 spec に切り出す粒度ではない
- いずれも挙動変更を伴わない軽量リファクタで、テスト範囲・レビュー負荷ともに小さい
- 相互干渉がなく、同一 PR 内での変更が競合しない
- 分割すると PR 4 本が発生し、Container 着手（Phase 1）までの引き延ばしコストが実作業より大きくなる

## Impact on Existing Features

本 spec のすべての変更は挙動不変のリファクタに限定される。既存機能への影響は以下の通り:

- **R1（終了コード定数の単一ソース化）**: import 先のモジュールパスのみ変更。`EXIT_SUCCESS` / `EXIT_ERROR` の値・import される名前・使用箇所での動作は不変
- **R2（ルート解決関数の引数整理）**: 関数シグネチャから未使用引数を削除するのみ。戻り値の解決ロジックとセマンティクスは不変
- **R3（help 処理経路の単一化）**: 5 入力パターン（引数なし / `-h` / `--help` / `help` / `help <topic>`）の出力内容と終了コードは不変。内部の分岐構造のみ単一化
- **R4（配線ゼロ補助関数の除去）**: 削除対象は定義のみで参照ゼロ。ランタイム挙動への影響なし

既存 CLI コマンドインターフェース（サブコマンド名・オプション・終了コード契約）の意味変更は発生しない。

## Scope

- 終了コード定数を単独モジュールから共通定数モジュールへ集約し、旧モジュールを削除する
- リポジトリルート解決関数から未使用引数（`importMetaUrl`）を削除する
- help 処理経路を CLI エントリ内の 1 分岐に統合し、独立コマンドマップから `help` を除去する
- 配線ゼロの補助関数 `writeAgentContext` / `cleanupAgentContext` を削除する（復活用資料は別 board に保存済み）

## Out of Scope

- Container クラス / ディスパッチャの設計・導入（Phase 1）
- agent API（`callAgent*` 系 10 関数）の引数整理・provider クラス化（Phase 2A）
- FlowManager / Logger / flow registry の再設計（Phase 2B・2C・3）
- `.tmp/1877.md` 指摘 5〜31 の各項目

## Clarifications (Q&A)

- Q1: issue #154 の 4 タスクを phase0 小規模クリーンアップとして進めてよいか？
  - A: はい（ユーザー承認 [1]）
- Q2: 終了コード定数の統合先・旧モジュールの処遇は？
  - A: 共通定数モジュール（`src/lib/constants.js`）に追加し、`src/lib/exit-codes.js` は削除する（ユーザー承認 [1]）。根拠: alpha ポリシー「後方互換コードを書かない」
- Q3（AI 自答）: 4 修正を 1 PR に束ねるか分割するか？
  - A: 1 PR に束ねる。根拠: `.tmp/1877.md` で同一フェーズにグルーピング済・相互干渉なし・挙動不変
- Q4（AI 自答）: テスト配置は `tests/` / `specs/<spec>/tests/` のどちらか？
  - A: spec 検証用スモークは `specs/181-phase0-cleanup/tests/`。既存 `tests/` は変更せず `npm test` で通過させる

## Alternatives Considered

- **旧 `exit-codes.js` を残して再エクスポート**: alpha ポリシー（後方互換コードを書かない）に反するため却下
- **4 要件を 4 PR に分割**: Container 着手時期が遅れる。変更範囲が軽微・相互干渉なしのため 1 PR に集約
- **`help` を `INDEPENDENT` マップに残す**: 2 経路分裂（早期分岐 vs マップ経由で `process.argv` 書き換え方法が異なる）の実害を解消しないため却下
- **`writeAgentContext` / `cleanupAgentContext` を保留**: 配線ゼロ dead code は alpha ポリシー「非推奨パスは保持せず削除」に従い即削除

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-17
- Notes: User approved [1] after gate PASS.

## Requirements

### R1（P1）: 終了コード定数の単一ソース化

- **R1.1**: **When** 本 spec 完了後にコードベース内で終了コード定数（`EXIT_SUCCESS` / `EXIT_ERROR`）を参照する任意の import を解析するとき、**shall** その参照先モジュールは共通定数モジュール（`src/lib/constants.js`）である。
- **R1.2**: **When** 本 spec 完了後にコードベース内で旧モジュール（`src/lib/exit-codes.js`）への import を探索するとき、**shall** 検出件数は 0 件であり、かつ旧モジュールファイル自体も存在しない。
- **R1.3**: **When** `src/lib/constants.js` を読み込むとき、**shall** `EXIT_SUCCESS = 0` と `EXIT_ERROR = 1` が named export として取得できる。

### R2（P2）: リポジトリルート解決関数の引数整理

- **R2.1**: **When** 本 spec 完了後に `repoRoot` 関数の定義（シグネチャおよび JSDoc）を解析するとき、**shall** `importMetaUrl` 引数は記述されていない。
- **R2.2**: **When** 本 spec 完了後にコードベース内で `repoRoot(import.meta.url)` 形式の呼び出しを探索するとき、**shall** 検出件数は 0 件である。
- **R2.3**: **When** `repoRoot()` を呼び出すとき、**shall** 戻り値は以下 3 条件で従来と同一結果を返す:
  - (a) `SDD_FORGE_WORK_ROOT` 環境変数設定時 → その値
  - (b) 未設定かつ git リポジトリ内 → `git rev-parse --show-toplevel` の結果
  - (c) 未設定かつ git リポジトリ外 → `process.cwd()`

### R3（P2）: help 処理経路の単一化

- **R3.1**: **When** 本 spec 完了後に CLI エントリ（`src/sdd-forge.js`）の構造を解析するとき、**shall** help 処理は早期分岐ブロック 1 箇所のみに存在し、`INDEPENDENT` マップには `help` エントリが含まれない。
- **R3.2**: **When** ユーザーが以下 5 入力パターンのいずれかを実行するとき、**shall** help 出力内容と終了コードは従来と同一である:
  - `sdd-forge`（引数なし）
  - `sdd-forge -h`
  - `sdd-forge --help`
  - `sdd-forge help`
  - `sdd-forge help <topic>`
- **R3.3**: **If** ユーザーが `sdd-forge help <topic>` 形式で追加引数を渡したとき、**shall** 早期分岐側は `rest` を `process.argv` に含めて help スクリプトに伝達する。

### R4（P1）: 配線ゼロ補助関数の除去

- **R4.1**: **When** 本 spec 完了後に `src/lib/agent.js` の export を解析するとき、**shall** `writeAgentContext` / `cleanupAgentContext` の定義は存在しない。
- **R4.2**: **When** 本 spec 完了後にコードベース全体で `writeAgentContext` / `cleanupAgentContext` 文字列を探索するとき、**shall** 検出件数は 0 件である（コメント・JSDoc を含む）。
- **R4.3**: **If** 補助関数削除により特定の import（例: `crypto`）が未使用となるとき、**shall** その import 文も合わせて削除されている。

## Acceptance Criteria

- `npm test`（`test:unit` / `test:e2e` / `test:acceptance`）がすべてパスする
- `specs/181-phase0-cleanup/tests/` 配下のスモークテストがパスする:
  - help 5 入力パターンで出力と終了コードが同一
  - 未知サブコマンドは `EXIT_ERROR`（= 1）で終了
- `grep -r "from.*exit-codes" src/` が 0 件
- `grep -r "writeAgentContext\|cleanupAgentContext" src/` が 0 件
- `grep -r "repoRoot(import\.meta\.url)" src/` が 0 件
- `grep -rE "^import.*\"./lib/constants.js\"" src/` で `EXIT_SUCCESS` / `EXIT_ERROR` 参照元が期待通りヒットする

## Open Questions

（なし — draft 段階で全論点確定済み）
