---
title: fix-finalize-retro-container
issue: 179
---

# Draft: finalize の retro が container.get is not a function で失敗するバグ修正

**開発種別:** バグ修正

**目的:** `sdd-forge flow run finalize` 実行時に retro 処理が `container.get is not a function` エラーで失敗しており、retro.json が生成されず report/metrics に retro 情報が欠落している。この退行を解消し、finalize の retro ステップが正常完了するようにする。

## Pre-investigation

- 対象エラー文字列をコードベース内で検索し、フロー共通基底のコマンド実行経路で発生していることを確認
- 同種の誤呼び出しがコードベース内で1件のみであることを検索で確認（他コマンドへの類似バグ波及なし）
- プロジェクト内に正しい呼び出しパターンを採る既存コマンドが存在することを確認（修正は既存パターンへの整列で済む）

## Scope

- finalize の retro ステップ呼び出しの不具合修正
- 修正箇所に対する退行防止用の自動テスト追加

## Out of Scope

- retro 以降のステップ（report, merge, sync, cleanup）のリファクタ
- フロー共通基底クラスのインターフェース変更
- finalize 以外のコマンドへの修正

## Requirements (優先度順)

**P1（必須）:**

1. When a user runs `sdd-forge flow run finalize` against a valid flow state, the command shall not raise `container.get is not a function`.
2. When the finalize pipeline completes, the system shall generate `retro.json` under the current spec directory.

**P2（必須・同一 PR で対応）:**

3. When the finalize pipeline completes, the finalize result payload shall contain a retro summary so that `report.json` generation receives it.
4. When a future change breaks the finalize retro invocation in the same way, `npm test` shall fail (a regression test under `tests/` shall cover this bug).

## Impact on Existing Features

- finalize の retro ステップ: 現状は常に失敗 → 修正後は正常完了する
- `report.json`: retro サマリが反映されるようになる
- flow metrics: retro データが記録されるようになる
- `retro.json`: spec ディレクトリに生成されるようになる
- 他コマンド（gate, impl, sync 等）: 影響なし

## Alternatives Considered

- **A. 誤った呼び出し側を既存パターンに整列させる（採用）:** 呼び出し側を既存の正しい使い方に戻すのみ。差分最小、影響範囲も限定的。基盤: 既存コード規約（`src/CLAUDE.md`「既存コードパターンに合わせる」）。
- **B. 基盤側の入力受理を広げる:** 不採用。誤った入力を黙認するのは誤呼び出しの検出を難しくする。基盤: プロジェクト方針（`CLAUDE.md`「alpha 版ポリシー」「過剰な防御コードを書かない」）。

## Test Strategy

- 配置: `tests/`（formal, `npm test` で実行）
- 判断基準: `CLAUDE.md` のテスト配置ルール「このテストが将来壊れたら常にバグか？」に YES なので formal 配置
- 方針: finalize の retro 呼び出しが成功する（エラーで失敗しない）ことを確認する退行防止テストを追加する

## Open Questions

なし

## Q&A

### Q1: Issue #179 の修正意図の確認

**AI 推奨:** `container.get is not a function` バグを、他コマンドと同じ呼び出しパターンに揃えて修正する。
**基盤:** 既存コード規約（`src/CLAUDE.md`「新しいコードは既存のコードパターン・命名規約に合わせること」）

**User:** [1] はい

### Q2: テストの配置

**AI 推奨:** `tests/`（formal）
**基盤:** `CLAUDE.md`「`tests/` (formal) = 退行が常にバグとなるテスト」。finalize の retro 失敗は spec 文脈に依存せず常にバグのため。

**User:** [1] `tests/` (formal)

### Q3: draft の承認

**AI 推奨:** 承認し gate-draft に進む。
**基盤:** 要件カテゴリチェックリスト（Goal/Scope/Impact/Constraints/Edge/Test/Alternatives/Future）をすべて記述済み。

**User:** [1] 承認

## User Confirmation

- [x] User approved this draft
- 承認日: 2026-04-19
