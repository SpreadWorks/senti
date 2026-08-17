# Feature Specification: 067-lang-layer-chapter-union

**Feature Branch**: `feature/067-lang-layer-chapter-union`
**Created**: 2026-03-17
**Status**: Draft
**Input**: lang 層の chapters を parent チェーンの chapters と union マージし、テンプレート合成を自動化する

## Goal

preset の lang 層（php, node）が提供する章を、parent チェーンの chapters と自動的に union マージする。
これにより、lang 層に `stack_and_ops.md` 等の章を定義するだけで、全ての子 preset に自動的に反映される。
各 preset の `chapters` 配列に手動で追加する必要がなくなる。

## Background

spec #065 で preset 階層を parent チェーン + lang 層に再設計した。DataSource のロードは合成されているが、テンプレート（chapters）の合成は未実装。node-cli の chapters に `stack_and_ops.md` を手動で追加して動作確認したが、本来は lang 層が提供する章は自動的に union されるべき。

## Scope

### 1. lang 層 preset に chapters を定義

- `src/presets/node/preset.json` に `"chapters": ["stack_and_ops.md"]` を追加
- `src/presets/php/preset.json` に `"chapters": ["stack_and_ops.md"]` を追加
- lang 層が提供する章は、その言語を使う全 preset に自動適用される

### 2. resolveChaptersOrder の union マージ実装

`src/docs/lib/template-merger.js` の `resolveChaptersOrder()` を修正：

- 現行: parent チェーンの最も具体的な chapters を採用（上書き方式）
- 新規: parent チェーンの chapters を確定後、lang 層の chapters を union マージ

union ルール:
- parent チェーンの chapters が基本（現行通り最も具体的な preset の chapters を採用）
- lang 層の chapters にあって parent チェーンの chapters にない章を追加
- 挿入位置: lang 層の章は `overview.md` の直後に挿入（技術スタック情報は概要の次が自然）
- 既に parent チェーンの chapters に含まれている章は重複追加しない

### 3. buildLayers の lang 層対応

`buildLayers()` が lang 層のテンプレートディレクトリもレイヤーに含める。
これにより lang 層が提供するテンプレートファイル（例: node 固有の stack_and_ops.md）が解決可能になる。

### 4. node-cli の chapters から手動追加分を削除

spec #065 で手動追加した `stack_and_ops.md` を node-cli の chapters から削除する。
union マージにより自動的に追加されるようになるため。

### 5. docs 再生成と品質検証

- sdd-forge 自身で `scan → data` を実行し、`config.stack` が引き続き出力されることを確認
- review PASSED を確認

## Out of Scope

- lang 層固有のテンプレートファイル作成（現時点では base の stack_and_ops.md を継承）
- モノレポの章合成
- platform / database 軸の章合成

## Design Decisions

### なぜ上書きではなく union か

parent チェーンの chapters は「このアーキテクチャに必要な章」を定義する。lang 層の chapters は「この言語を使うなら追加すべき章」を定義する。両者は排他的ではなく補完的なので、union が適切。

### 挿入位置

lang 層の章（stack_and_ops.md 等）は技術スタック情報なので、overview の直後が読者にとって自然な配置。

## Clarifications (Q&A)

- Q: lang 層の chapters が parent チェーンの chapters と衝突した場合は？
  - A: 既に存在する章は追加しない（重複排除）。parent チェーン側の位置を維持。

- Q: 複数の lang 層が存在する場合は？
  - A: 現時点では 1 preset に 1 lang 層のみ。将来的に複数対応が必要になれば別 spec。

## User Confirmation
- [x] User approved this spec
- Confirmed at:
- Notes:

## Requirements

1. `src/presets/node/preset.json` に `"chapters": ["stack_and_ops.md"]` を追加する。`sdd-forge docs init` 実行時に node lang 層を使う preset でこの章が自動的に章構成に含まれる。
2. `src/presets/php/preset.json` に `"chapters": ["stack_and_ops.md"]` を追加する。同上。
3. `resolveChaptersOrder()` を修正し、parent チェーンの chapters 確定後に lang 層の chapters を union マージする。lang 層の章が parent チェーンの chapters に未含有の場合のみ `overview.md` の直後に挿入する。
4. `buildLayers()` を修正し、lang 層のテンプレートディレクトリをレイヤー配列に含める。`sdd-forge docs init` 実行時に lang 層のテンプレートが解決対象になる。
5. `src/presets/node-cli/preset.json` の chapters から手動追加した `stack_and_ops.md` を削除する。union マージで自動追加されるため不要になる。
6. sdd-forge 自身で `scan → data` を実行し、`docs/stack_and_ops.md` に `config.stack` テーブルが出力されることを確認する。
7. `sdd-forge docs review` が PASS することを確認する。
8. `npm test` が全て PASS することを確認する。

## Acceptance Criteria

1. `resolveChaptersOrder("cli/node-cli")` が `stack_and_ops.md` を含む（lang 層から自動追加）
2. `resolveChaptersOrder("webapp/cakephp2")` が `stack_and_ops.md` を含む（webapp の chapters に既にあるので重複なし）
3. node-cli の preset.json に `stack_and_ops.md` が手動で書かれていない
4. `sdd-forge docs init` で `stack_and_ops.md` が生成される
5. `sdd-forge docs data` で `config.stack` が解決される
6. `npm test` 全 PASS
7. `sdd-forge docs review` PASS

## Open Questions

(なし)
