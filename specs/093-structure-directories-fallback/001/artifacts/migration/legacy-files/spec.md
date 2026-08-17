# Feature Specification: 093-structure-directories-fallback

**Feature Branch**: `feature/093-structure-directories-fallback`
**Created**: 2026-03-28
**Status**: Draft
**Input**: GitHub Issue #23

## Goal

`StructureSource.directories()` がトップレベル1ディレクトリしかない場合に、子ディレクトリで再集約するフォールバックを追加する。これにより、`src/` や `app/` 配下に全ファイルが集中するプロジェクトでも、構造テーブルが意味のある粒度で表示される。

### Why this approach

トップレベル集約が1行になるのは「プロジェクトのルートに1つの主要ディレクトリがある」という構造的特徴。パターン定義ではなく「結果が1行なら1段深くする」という汎用ルールで、どのプリセットでも自動的に効く。再帰的に展開することで、`app/src/` のような深い単一パスにも対応する。

## Scope

- `src/presets/base/data/structure.js` の `directories()` メソッドの修正

## Out of Scope

- `tree()` メソッドの変更（全ディレクトリをフラット表示するため問題なし）
- 展開上限の config.json 設定化
- 他の DataSource の変更

## Clarifications (Q&A)

- Q: 展開の深さは？
  - A: 再帰的に展開する。結果が1エントリなら繰り返し、上限はコード内定数 5。
- Q: 上限は config.json で設定可能にするか？
  - A: しない。コード内定数で十分。必要になれば後から追加。
- Q: `tree()` も変更するか？
  - A: しない。`tree()` は全ディレクトリをフラット表示するため問題がない。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-03-28
- Notes: Draft Q&A を経て全要件合意済み

## Requirements

優先度: P1（コア機能） > P2（安全策） > P3（互換性保証）

### P1: コア機能

1. `directories()` でトップレベル集約後の結果が1エントリの場合、そのディレクトリの子ディレクトリで再集約する
2. 再集約後もまだ1エントリの場合、さらに1段深い階層で再集約を繰り返す

### P2: 安全策

3. 再帰の上限はコード内定数 `MAX_EXPAND_DEPTH = 5` とする
4. 上限に達した場合はその時点の結果をそのまま返す（1行でも許容）

### P3: 互換性保証

5. トップレベルが2エントリ以上の場合は、既存の動作と同一（変更なし）

## Acceptance Criteria

1. トップレベルが `src/` のみのプロジェクトで、`src/controllers`, `src/models` 等の子ディレクトリが行として表示される
2. トップレベルが `app/src/` のような深い単一パスの場合、再帰的に展開される
3. トップレベルが複数（`src/`, `tests/` 等）の場合、従来通りトップレベルで集約される
4. 展開が5段を超えない
5. `tree()` の出力に変更がない

## Open Questions

（なし）
