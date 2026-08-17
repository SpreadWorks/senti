# Feature Specification: 109-improve-silent-error-catch

**Feature Branch**: `feature/109-improve-silent-error-catch`
**Created**: 2026-03-31
**Status**: Draft
**Input**: Issue #42

## Goal

Issue #42 に記載された8箇所の `catch (_) {}` パターンを改善し、ENOENT 以外のエラーを `console.error` で出力するようにする。デバッグ困難な状況を解消する。

## Scope

Issue #42 に記載された以下の箇所のみ対応する:

- `src/setup.js:225`
- `src/flow/run/impl-confirm.js:108`
- `src/lib/agent.js:369`
- `src/lib/flow-state.js:152`
- `src/lib/flow-state.js:225`
- `src/lib/skills.js:28`
- `src/lib/skills.js:77`
- `src/docs/commands/changelog.js:136`

## Out of Scope

- 上記8箇所以外の `catch (_) {}` パターン（66箇所中の残り58箇所）
- `logger.debug` メソッドの新規追加
- 共通ユーティリティ（`safeUnlink` 等）の作成

## Clarifications (Q&A)

- Q: ENOENT 以外のエラーは rethrow するか？
  - A: rethrow しない。対象箇所は「ファイルがなければデフォルトで続行」のパターンが多く、rethrow するとプロセスが停止する。`console.error` で出力してデバッグを可能にしつつ、既存動作は維持する。

- Q: logger を import するか？
  - A: しない。対象ファイルの多くは logger を使っていない。`console.error` で統一する。

## User Confirmation

- [x] User approved this spec (autoApprove)
- Confirmed at: 2026-03-31
- Notes: autoApprove mode

## Requirements

1. (P1) 8箇所の `catch (_) {}` を `catch (err) { if (err.code !== "ENOENT") console.error(err); }` に変更する
2. (P1) `JSON.parse` を含む catch では `err.code` が存在しない（SyntaxError）ため、条件 `err.code !== "ENOENT"` は true となり正しく出力される
3. (P2) 既存の動作（ENOENT 時にデフォルト値で続行）は変更しない
4. (P2) 既存テストがパスする

## Acceptance Criteria

- 8箇所すべてで `catch (_) {}` が `catch (err) { if (err.code !== "ENOENT") console.error(err); }` に置換されている
- ENOENT 発生時は従来通り黙って続行する（出力なし）
- 非 ENOENT エラー発生時は stderr にエラーが出力される
- 既存テストがパスする

## Open Questions

- なし
