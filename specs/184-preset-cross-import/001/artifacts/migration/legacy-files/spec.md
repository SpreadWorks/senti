# Feature Specification: 184-preset-cross-import

**Feature Branch**: `feature/184-preset-cross-import`
**Created**: 2026-04-17
**Status**: Draft
**Input**: GitHub Issue #160 — 外部プリセット間のクロスimport（sdd-forge/preset/* ローダーフック拡張）

## Goal

外部プリセット（`.sdd-forge/presets/` 配下および `~/.sdd-forge/presets/` 配下）が、他のプリセット（ビルトインを含む）のクラスを `import 'sdd-forge/presets/<name>/<subpath>'` の形式で参照できるよう、sdd-forge の ESM module 解決を 3 層探索に拡張する。

## Scope

- `sdd-forge/presets/<name>/<subpath>` 形式の specifier を、プロジェクト層・ユーザー層・ビルトイン層の 3 層でルックアップする解決ロジックの追加。
- 解決結果のプロセス内キャッシュ。
- プロジェクト層として参照するディレクトリの sdd-forge プロセスへの引き渡し。

## Out of Scope

- プリセット継承（`preset.json` の `parent` チェーン）の動作変更。
- ディレクトリ index 解決（`<subpath>/index.js` の暗黙参照）。
- `.js` 以外の拡張子のサポート。
- fs ベースの永続キャッシュ。
- `sdd-forge/api` 等、既に解決可能な specifier の挙動変更。

## Clarifications (Q&A)

- Q: ネームスペースは単数形 `sdd-forge/preset/...` と複数形 `sdd-forge/presets/...` のどちらにするか？
  - A: 複数形 `sdd-forge/presets/...` を採用。既存 `sdd-forge/presets/...`（ビルトイン解決）との対称性を保つため。
- Q: 3 層探索の優先順位は？
  - A: プロジェクト（`.sdd-forge/presets/`）→ ユーザー（`~/.sdd-forge/presets/`）→ ビルトイン（`src/presets/`）。近い層が優先。
- Q: キャッシュ方式は？
  - A: プロセス内 in-memory のみ。CLI プロセスは短命のため fs 永続キャッシュは過剰。
- Q: 未検出時の挙動は？
  - A: Node 標準の module 解決エラーに委ねる（loader でエラーを throw しない）。

## Alternatives Considered

- **単数形ネームスペース `sdd-forge/preset/<name>/...`**（Issue 本文の原案）: 既存 `sdd-forge/presets/` との対称性が崩れ、利用側が単複で使い分ける必要が生じる。**不採用**。
- **fs 永続キャッシュ**: ファイル追加・削除時の無効化ロジックが必要でコード複雑度が増す。CLI プロセスは短命で in-memory Map の再構築コストは無視できる。**不採用**。
- **preset.json の継承チェーンを解決経路として使う**: loader はファイルパス解決のみを担うべきで、preset 継承とは関心が異なる。継承チェーン走査は既存の `resolveChain` に任せ、loader は純粋な 3 層ディレクトリ探索に留める。**不採用**。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-17
- Notes: autoApprove enabled via /sdd-forge.flow-auto

## Requirements

**P1（必須）**

- **REQ-1:** `sdd-forge/presets/<name>/<subpath>` 形式の import specifier を受けた場合、システムは以下の順序で該当 `.js` ファイルの存在を確認し、最初に見つかった層のファイル URL を解決結果として返さなければならない（shall）:
  1. プロジェクト層: `<projectRoot>/.sdd-forge/presets/<name>/<subpath>.js`
  2. ユーザー層: `<userHome>/.sdd-forge/presets/<name>/<subpath>.js`
  3. ビルトイン層: `<pkgRoot>/src/presets/<name>/<subpath>.js`
- **REQ-2:** 3 層いずれにも対象ファイルが存在しない場合、システムは解決を行わず Node 標準の module 解決処理に委ねなければならない（shall）。loader 側でエラーを throw してはならない。

**P2（回帰防止）**

- **REQ-3:** `sdd-forge/presets/<name>/<subpath>` 形式に一致しない既存の `sdd-forge/<subpath>` specifier（例: `sdd-forge/api`）を受けた場合、システムは本改修前と同じ解決結果を返さなければならない（shall）。

**P3（性能）**

- **REQ-4:** 同一 specifier の 2 回目以降の解決時、システムはファイルシステムへの探索アクセスを行わず、初回の解決結果を再利用しなければならない（shall）。キャッシュの有効範囲はプロセス寿命とする。

**P4（統合）**

- **REQ-5:** sdd-forge CLI 起動時、loader にプロジェクト層のルートディレクトリ（`SDD_WORK_ROOT` 相当）が引き渡されなければならない（shall）。プロジェクト層のルートが特定できない実行コンテキスト（グローバルヘルプ等）では、REQ-1 のステップ 1（プロジェクト層探索）はスキップされなければならない（shall）。

## Acceptance Criteria

1. 外部プリセットコード内で `import X from 'sdd-forge/presets/<name>/<subpath>'` と書いたとき、`<name>` に対応する `<subpath>.js` がプロジェクト層・ユーザー層・ビルトイン層のいずれかに存在すれば成功する。
2. 3 層に同名ファイルが存在する場合、プロジェクト層のファイルが読み込まれる（ユーザー層・ビルトイン層より優先）。
3. 3 層いずれにも存在しない場合、Node の標準 "Cannot find module" エラーが発生する（loader 由来の独自エラーではない）。
4. `import 'sdd-forge/api'` など既存 specifier の解決結果が改修前と同一である（既存テストが失敗しない）。
5. 同一 specifier を 2 回 import した際、ファイルシステムアクセスは 1 回で済んでいる（2 回目はキャッシュから返る）。
6. プロジェクトルートが解決されない文脈（例: CLI がプロジェクト外から起動）でも、ユーザー層・ビルトイン層の解決だけは機能する。

## Test Strategy

**Unit テスト** (`tests/unit/loader/` への配置):

- `sdd-forge/presets/<name>/<subpath>` specifier について、各層にフィクスチャを配置してプロジェクト / ユーザー / ビルトインそれぞれの層が選ばれることを検証する。
- 3 層同名の場合の優先順位（プロジェクトが勝つ）を検証する。
- 3 層いずれにも無い場合、loader が `nextResolve` 相当の呼び出しにフォールスルーすることを検証する。
- `sdd-forge/api` 等の既存 specifier について、解決 URL が改修前と同一であることを検証する。
- キャッシュ: 同一 specifier 2 回目の解決で fs アクセスが発生しないことをスパイで検証する。
- プロジェクトルートが未指定（null）の場合、プロジェクト層探索がスキップされることを検証する。

**E2E テスト** (`tests/e2e/loader-cross-import/` または既存 acceptance への追加):

- 実際に `.sdd-forge/presets/<name>/data/source.js` を持つ fixture プロジェクトを用意し、別プリセット fixture から `import` して動作することを確認する。

ユーザー層（`~/.sdd-forge/presets/`）の直接テストは HOME を書き換えるテストフィクスチャで代替する（`process.env.HOME` を override）。

## Why This Approach

1. **既存ネームスペースの延長**: 既存の `sdd-forge/<subpath>` loader hook が `sdd-forge/presets/<name>/<subpath>` という部分集合に対してのみ挙動を拡張する形を取るため、他の specifier への副作用がない。
2. **関心の分離**: loader は「ファイルパス解決」、`resolveChain` は「preset 継承チェーン」と責務を明確に分ける。両者が同じコードで混ざるとメンテ性が下がる。
3. **Node 標準エラーへの委譲**: 未検出時に独自例外を投げないことで、利用者は Node 標準の module resolution error をそのまま受け取り、既存の debug ツールや stack trace が一貫する。
4. **最小キャッシュ**: プロセス寿命キャッシュのみで Issue の性能要件（毎 import 時の fs アクセス最小化）を満たせる。複雑な無効化ロジックを避ける。

## Impact on Existing Features

- **`sdd-forge/api` など既存 `sdd-forge/<subpath>` specifier**: REQ-3 により解決結果は変わらない。
- **ビルトインプリセット内の相対 import**: loader 経路を通らないため影響なし。
- **既存の `.sdd-forge/presets/<name>/` プロジェクトプリセット**: 現在も `resolveProjectPreset` から探索されている。本改修は loader 経由の import に限定した追加であり、既存の preset 解決経路（`resolveChain`）には触れない。

## Open Questions

なし（draft 時点で主要論点は確定済み）。
