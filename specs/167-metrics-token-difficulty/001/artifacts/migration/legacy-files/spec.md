# Feature Specification: 167-metrics-token-difficulty

**Feature Branch**: `feature/167-metrics-token-difficulty`
**Created**: 2026-04-12
**Status**: Draft
**Input**: User request

## Goal
- `sdd-forge metrics token` の `difficulty` が常に `N/A` になる問題を解消し、board 8690 の確定式に沿って計算値を表示する。
- 過去 spec で不足している `reviewCount` / `redoCount` を補完するスクリプトを用意し、`flow.json` ベース集計を成立させる。

## Scope
- `src/metrics/commands/token.js` に difficulty 計算ロジックを実装する。
- `difficulty` は spec 単位で算出し、`date × phase` 行では寄与 spec の平均値を表示する。
- 必須入力が欠損した spec は difficulty を `N/A` とし、コマンド全体は継続する。
- `specs/167-metrics-token-difficulty/fill-flow-counts.js` を追加し、`flow.json` の `reviewCount` / `redoCount` 欠損を補完できるようにする。
- `tests/e2e/metrics/token.test.js` に difficulty の算出/欠損ケースを追加する。

## Out of Scope
- `sdd-forge metrics efficiency` の実装。
- `.tmp/logs/**` を実行時に直接読むフォールバック。
- 既存コマンド体系（`metrics token --format text|json|csv`）の変更。

## Clarifications (Q&A)
- Q: difficulty の計算はどの範囲で実装するか？
  - A: board 8690 の確定式をフル実装し、必要データ欠損時は `N/A`。
- Q: `date × phase` 行へ spec 単位 difficulty をどう反映するか？
  - A: 寄与 spec の difficulty 平均値を採用する。
- Q: 必要指標の一部欠損時に部分計算するか？
  - A: しない。1つでも欠損ならその spec の difficulty は `N/A`。
- Q: `reviewCount` / `redoCount` の実データ不足をどう扱うか？
  - A: `specs/<spec>/` 配下に補完スクリプトを追加し、`flow.json` へ取得・設定する。
- Q: 補完値の算出元は？
  - A: `reviewCount` は `review.md` のレビュー項目数、`redoCount` は `issue-log.json` の `entries.length`。

## Alternatives Considered
- Alternative: `reviewCount` を `metrics.*.redo` や `issue-log` 件数で代用する。
  - Rejected: 指標の意味が混在し、board 8690 の定義から逸脱するため。
- Alternative: 欠損項目のみで部分 difficulty を計算する。
  - Rejected: スコアの比較可能性が崩れるため。

## User Confirmation
- [x] User approved this spec
- Confirmed at: 2026-04-12
- Notes: 「flowに沿って進める」方針で継続し、本仕様内容で進行することをユーザーが承認。

## Requirements
Priority: P1 > P2

- P1-R1: `sdd-forge metrics token` 実行時、spec 単位 difficulty を以下で算出すること。
  - `base_difficulty = average(min(specMdChars/10000,1)*100, min(requirementCount/20,1)*100, min(testCount/30,1)*100, min(redoCount/10,1)*100, min(reviewCount/30,1)*100, min(issueLogEntries/10,1)*100)`
  - `precision_multiplier = clamp((qaCount/requestChars)*100, 0.3, 3.0)`
  - `difficulty = base_difficulty * precision_multiplier`
- P1-R2: 必須入力（`specMdChars`, `requirementCount`, `testCount`, `redoCount`, `reviewCount`, `issueLogEntries`, `qaCount`, `requestChars`）のいずれかが欠損時、当該 spec difficulty は `N/A` とすること。
- P1-R3: `date × phase` 行の difficulty は、当該行に寄与した spec difficulty の平均値で表示すること。寄与 spec がすべて `N/A` の場合は行 difficulty も `N/A`。
- P1-R4: `--format text|json|csv` の difficulty 表示を同じ値系で統一し、`text/csv` は小数2桁、欠損は `N/A` とすること。
- P1-R5: `specs/167-metrics-token-difficulty/fill-flow-counts.js` を提供し、`flow.json` の欠損フィールドを補完できること。
  - `reviewCount`: `review.md` の `### [ ] N.` / `### [x] N.` 項目数を `spec` として設定し、`test/impl` は 0。
  - `redoCount`: `issue-log.json` の `entries.length` を設定。
  - 既存値がある場合は上書きしない。
  - `--spec <id>` / `--all` / `--dry-run` をサポートする。
- P2-R6: 既存の token/cache/cost 集計・キャッシュ再利用挙動を壊さないこと。

## Acceptance Criteria
- AC1: required フィールドが揃う spec では `metrics token --format json` の `rows[].difficulty` が数値になる。
- AC2: `reviewCount` / `redoCount` 欠損時は `metrics token --format csv` の difficulty 列が `N/A` になる。
- AC3: `fill-flow-counts.js --spec <id> --dry-run` が更新内容を表示し、`--all` で複数 spec を補完できる。
- AC4: `npm run test:unit` と `npm run test:e2e` が通過する。

## Open Questions
- None.
