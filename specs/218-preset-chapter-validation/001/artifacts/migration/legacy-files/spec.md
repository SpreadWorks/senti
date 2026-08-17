# Feature Specification: 218-preset-chapter-validation

**Feature Branch**: `feature/218-preset-chapter-validation`
**Created**: 2026-04-23
**Status**: Draft
**Input**: GitHub Issue #229

## Goal
- プリセットの章構成（`preset.json` の `chapters`）と、対応する `.md` テンプレートファイルの静的整合性を、既存コマンドの冒頭で検証して早期失敗させる。

## Background
- `preset.json` の `chapters` に列挙された章名に対応する `.md` テンプレートが親継承チェーン配下に存在しないと、`sdd-forge docs build` の途中（scan → enrich → init → ... の流れの中盤）で不明瞭なエラーが発生する。
- 章とテンプレートの整合性は、プリセットを書いた時点で確定する静的情報であるにもかかわらず、現状は重処理を経た後でしか検出されない。
- 外部プロジェクトでプリセットを拡張したユーザーから不明瞭な失敗の指摘があった。
- sdd-forge には既に類似の静的整合性検証が存在する（scan パターンと scan DataSource、data ディレクティブと DataSource メソッド、analysis キーのカバレッジ）。本件はこの既存枠組みへの自然な追加として位置づける。

## Scope
- プリセットの章構成に対する、テンプレート存在の静的検証ロジックを `src/lib/presets.js` に新設する。
- `sdd-forge upgrade` / `sdd-forge setup` / `sdd-forge docs build` の冒頭（プリセット解決直後、重処理の前）で検証を呼び出す。
- プリセット整合性テスト（`tests/unit/presets/preset-scan-integrity.test.js`）に同検証のテストケースを追加する。
- 検証ロジック自身の単体テストを追加する。

## Out of Scope
- 新規サブコマンド（例: `sdd-forge preset check`）の導入。CLI 表面積を増やさない方針に従う。
- 章構成のセマンティック検証（順序、依存関係、AI による読者層マッチング等）。
- 章に依存しないテンプレート（`AGENTS.md` / `README.md` / `layout.md` 等）の検証。
- 既存プリセット整合性テスト群（3 観点）の挙動変更。

## Constraints
- 外部依存禁止。Node.js 組み込みモジュールのみ使用する。
- `src/` 配下にプロジェクト固有情報を埋め込まない（汎用検証）。
- 過剰な防御コードを避ける。内部インターフェースは信頼し、妥当な引数を前提とする。
- alpha 期間中のため後方互換コードは書かない。
- 検証ループのバウンド: 反復は `chapters数 × languages数 × (chainプリセット数 + 1)` で上限される。再帰やバックトラックは行わない。既存の `resolveChainSafe()` が親チェーンの循環参照と深度エラーを既にガードしているため、追加の深度制限は不要。`existsSync` 呼び出し回数は上記積で決まる有限値となる。

## Design Principles
- 既存の探索ロジック（`buildLayers()` / `resolveChaptersOrder()`）と同じ解決規則を再利用し、検証結果と build 挙動の等価性を担保する。
- validator は「build 時に解決できる」ことを保証する。PASS なら build はテンプレート解決で失敗しない。
- 生成パイプラインの外（コマンド冒頭）で fail-fast する。重処理（scan 等）の前に失敗させる。

## Overview
### Modules
- `src/lib/presets.js` — 新規 export `validatePresetChain(types, projectRoot, { languages, configChapters })`。
- `src/upgrade.js` / `src/setup.js` / `src/docs/commands/build.js` — 検証呼び出しの挿入箇所。
- `tests/unit/presets/preset-scan-integrity.test.js` — テストケース追加。
- `tests/unit/presets/validate-preset-chain.test.js`（新規） — validator の単体テスト。

### Data Flow
```
CLI (upgrade / setup / docs build)
  → config.type, config.chapters, config.docs.languages を取得
  → validatePresetChain(types, root, { languages, configChapters })
     - 実効 chapters を resolveChaptersOrder(types, configChapters, root) で解決
     - 各 chapter × 各 language について、以下の順で existsSync:
         1. <root>/.sdd-forge/templates/<lang>/<chapter>
         2. chain 内の <preset.dir>/templates/<lang>/<chapter>（leaf → root）
     - どれも見つからない (chapter, lang) をエラーメッセージに集約
     - 欠落があれば Error を throw（非ゼロ exit code に至る）
  → PASS の場合のみ scan 以降の重処理に進む
```

### Decisions
- 検証の言語スコープは `config.docs.languages` の全言語。単一言語での通過検査は build 失敗を見逃すため採らない。
- テンプレート探索範囲はプリセット継承チェーン＋プロジェクトローカルテンプレート層（`.sdd-forge/templates/<lang>/`）。build-time の `buildLayers()` と同じ 2 層構造とする。
- 検証対象の章は実効章構成（`config.chapters` による上書きがあればそれ、なければプリセット定義）。`resolveChaptersOrder()` と同じ優先順位。
- 逆向き（テンプレート存在するが章に無い）は警告のみに留める。章の意図的無効化を許容する。
- 警告は `stderr` に書く。build を止めない。

## Clarifications (Q&A)
- Q1: 検証の言語スコープは？
  - A1: プロジェクト設定の配信言語（`config.docs.languages`）すべてで検証する。
- Q2: テンプレートの探索範囲は？
  - A2: プリセット継承チェーン＋プロジェクトローカル `.sdd-forge/templates/<lang>/`。build-time の探索と一致させる。
- Q3: `config.chapters` による章上書きの扱いは？
  - A3: 実効章構成（`config.chapters` > preset chain）を検証する。

## Alternatives Considered
- 新規サブコマンド `sdd-forge preset check <key>` の導入: 却下。CLI 表面積が増え、ユーザーが明示的に実行しないと意味をなさず運用に依存するため。既存のプリセット解決点に相乗りする方針を優先。
- `docs build` のみに検証を入れる案: 却下。`upgrade` / `setup` の時点で気づける方が外部プリセット拡張ユーザーの初期セットアップ時の体験が良い。
- 警告 (逆向き検出) を error 化する案: 却下。章の意図的無効化（template だけ残して chapters から外す運用）を許容する必要がある。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-23
- Notes: User approved draft + spec. auto mode enabled at approval step.

## Requirements
- **R1 [P1]**: When プリセット解決が完了した直後、 system shall `validatePresetChain` を呼び出し、章-テンプレート整合性を検証する（呼び出し箇所は `upgrade` / `setup` / `docs build`）。
- **R2 [P1]**: When `validatePresetChain` が実行されるとき、 system shall 実効章構成（`config.chapters` > プリセット定義）を決定する。
- **R3 [P1]**: When 実効章構成が決定したとき、 system shall 各章 × `config.docs.languages` の各言語のペアに対してテンプレート存在を確認する。
- **R4 [P1]**: When テンプレート存在を確認するとき、 system shall まず `<projectRoot>/.sdd-forge/templates/<lang>/<chapter>` を探索し、次に継承チェーン内の各プリセットの `<preset.dir>/templates/<lang>/<chapter>` を leaf → root の順に探索する。いずれかで見つかれば PASS、全て見つからなければ欠落としてマークする。
- **R5 [P1]**: If 1 件以上の欠落 (chapter, lang) があるとき、 system shall 欠落一覧・探索したディレクトリパス一覧を含むメッセージで `Error` を throw する。呼び出し元は非ゼロ exit code で終了する。
- **R6 [P1]**: If 欠落が 0 件のとき、 system shall 静かに return する（副作用なし）。
- **R7 [P2]**: If チェーン内または `.sdd-forge/templates/<lang>/` に `<chapter>.md` の形式で存在するが実効章構成に記載のないテンプレートがあるとき、 system shall 警告メッセージを `stderr` に 1 件出力し、処理は継続する。
- **R8 [P2]**: When `tests/unit/presets/preset-scan-integrity.test.js` が実行されるとき、 test suite shall 全組み込みプリセットに対して `validatePresetChain` を `config.docs.languages = [<各プリセットの templates/ 配下に存在する全言語>]` 相当で呼び出し、欠落 0 件であることを検証する。
- **R9 [P3]**: When 新規 `tests/unit/presets/validate-preset-chain.test.js` が実行されるとき、 test suite shall 以下の観点を個別に検証する:
  - 欠落がない場合に静かに return する。
  - 欠落がある場合に Error を throw し、メッセージに欠落した (chapter, lang) と探索パスが含まれる。
  - プロジェクトローカル `.sdd-forge/templates/<lang>/<chapter>` がある場合にプリセットチェーン側に無くても PASS する。
  - `config.chapters` で上書きされた章構成が優先される。
  - 章に無いテンプレートが存在した場合に警告のみ（throw しない）。

## Acceptance Criteria
- AC1 (R1, R2, R3, R4): 健全なプリセット構成で `sdd-forge upgrade` / `sdd-forge setup` / `sdd-forge docs build` を実行すると検証が PASS し、従来と同じコマンド出力・exit code 0 となる。
- AC2 (R5): プロジェクト preset で章を追加しテンプレートを提供しない状態で `sdd-forge docs build` を実行すると、`scan` の出力より前に検証エラーで停止し、非ゼロ exit code で終了する。メッセージには欠落した章名・言語・探索済みディレクトリパス一覧が含まれる。
- AC3 (R7): `templates/<lang>/extra.md` は存在するが章構成に未記載の場合、`stderr` に警告が出力され、コマンドは正常終了する。
- AC4 (R8): `npm test` 実行時、`preset-scan-integrity.test.js` に追加した章-テンプレート整合性テストが全組み込みプリセットで PASS する。
- AC5 (R9): `npm test` 実行時、`validate-preset-chain.test.js` の全テストが PASS する。

## Implementation Targets
- `src/lib/presets.js`
- `src/upgrade.js`
- `src/setup.js`
- `src/docs/commands/build.js`
- `tests/unit/presets/preset-scan-integrity.test.js`
- `tests/unit/presets/validate-preset-chain.test.js`（新規）

## Authorized Existing Test Modifications
- `tests/unit/presets/preset-scan-integrity.test.js` — 既存 3 観点の整合性テストに加え、章-テンプレート整合性の 4 番目の検証ブロックを追加する。既存テスト関数の削除・期待値変更は行わず、新規 describe ブロックの追加のみ。

## Open Questions
- なし
