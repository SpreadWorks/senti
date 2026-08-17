# Feature Specification: 119-fix-missing-docsread-srcread-metrics

**Feature Branch**: `feature/119-fix-missing-docsread-srcread-metrics`
**Created**: 2026-04-02
**Status**: Draft
**Input**: GitHub Issue #59

## Goal

Flow 実行中のメトリクス・状態記録を hook に集約し、スキルからのコマンド呼び出しを削減する。docsRead/srcRead メトリクスの計測漏れを解消する。

## Scope

1. `runEntry` の hook ライフサイクル再設計（pre/post/onError/finally）
2. registry に全 run コマンドの pre/post hook 追加（step 自動更新）
3. `get.context` のメトリクス記録を registry post hook に移動
4. `set.redo` の post hook で redo メトリクス自動インクリメント
5. `prepare-spec` に `--issue`/`--request` 引数追加
6. スキルテンプレート更新（冗長な set step 削除、Read 後の metric 記録指示追加）

## Out of Scope

- スキルでのみ対応可能な set (note, summary, req, metric question, redo, auto) の変更
- `flow set issue` / `flow set request` コマンド自体の削除（prepare-spec 引数と共存）
- context.js の `loadConfig` 未インポートバグの修正（別 spec で対応）

## Clarifications (Q&A)

- Q: onError/finally hook は今回実装するか？
  - A: Issue 設計通り実装する。将来の拡張ポイントとして。

- Q: prepare-spec への --issue/--request は hook ではなく本体で実装する理由は？
  - A: prepare-spec は flow.json を**作成する**唯一のコマンド。他の run コマンドは既存 flow.json を読み書きするだけで、呼び出し元データの保存は不要。この例外性をコードコメントで明記する。

- Q: docsRead/srcRead の自動記録はどこで実装するか？
  - A: registry の get.context post hook に移動。context.js 内部の incrementMetric 呼び出しは削除。「状態書き込みは hook の責務」という一貫性を保つ。

- Q: analysis.json の読み込みはどちらのメトリクスか？
  - A: docsRead。list mode と search mode は analysis.json を読むため docsRead。

- Q: スキルの Read ツール後のメトリクス記録はどうするか？
  - A: スキルテンプレートに「Read ツールで docs/ や src/ を読んだら `flow set metric` を呼ぶ」指示を追加する。AI が守らないリスクは残るが、指示がなければ確実に 0。

## User Confirmation

- [x] User approved this spec
- Confirmed at: 2026-04-02
- Notes: Gate PASS 後に承認

## Requirements

Priority order:

1. **R1: runEntry hook lifecycle** — `flow.js` の `runEntry` を try/catch/finally 構造に変更し、pre/post/onError/finally の 4 hook をサポートする。既存の before/after は pre/post にリネームする。
2. **R2: registry hook 拡張** — `registry.js` で以下を実装する:
   - (a) before/after を pre/post にリネーム（gate, review）
   - (b) impl-confirm, finalize, sync, lint, retro に pre/post hook 追加（step 自動更新）
   - (c) get.context に post hook 追加（docsRead/srcRead メトリクス自動記録）
   - (d) set.redo に post hook 追加（redo メトリクス自動インクリメント）
3. **R3: incrementMetric の共有化** — registry post hook や set/metric.js から metric を記録する際に `flow-state.js` の共有関数を使用する。具体的には: context.js 内の `incrementMetric` 関数を `flow-state.js` に移動し export する。context.js 内の直接呼び出しは削除し、registry の get.context post hook から呼び出す形に変更する。
4. **R4: prepare-spec 引数追加** — `prepare-spec.js` に `--issue <number>` と `--request <text>` オプションを追加し、flow.json 作成時に含める。本体での状態書き込みは例外であることをコメントで明記する。
5. **R5: スキルテンプレート更新** — flow-plan と flow-impl の SKILL.md で:
   - (a) hook 化された step の手動 `set step` 呼び出しを削除
   - (b) prepare-spec に `--issue`/`--request` を渡すように変更
   - (c) Read ツール後の metric 記録指示を追加（docs/ → docsRead, src/ → srcRead）
   - (d) prepare-spec 後の冗長な `set step approach/branch/prepare-spec done` を削除

## Acceptance Criteria

- AC1: `sdd-forge flow run gate` 実行時に `flow.json` の gate step が自動的に in_progress → done/in_progress に更新される（既存動作の維持、before/after → pre/post リネーム）
- AC2: `sdd-forge flow run review` 実行時に同様に step が自動更新される
- AC3: `sdd-forge flow run finalize`, `sync`, `retro`, `lint`, `impl-confirm` 実行時に対応する step が自動更新される
- AC4: `sdd-forge flow get context <file>` 実行時に docsRead/srcRead メトリクスが自動記録される（post hook 経由）
- AC5: `sdd-forge flow get context` (list mode) 実行時に docsRead メトリクスが自動記録される
- AC6: `sdd-forge flow get context --search <query>` 実行時に docsRead メトリクスが自動記録される
- AC7: `sdd-forge flow set redo --step X --reason Y` 実行時に redo メトリクスが自動インクリメントされる
- AC8: `sdd-forge flow prepare --title "..." --issue 59 --request "..."` で flow.json に issue と request が含まれる
- AC9: `sdd-forge flow prepare --title "..."` (--issue/--request なし) が既存動作通り動く
- AC10: runEntry で execute が例外を投げた場合、onError hook が呼ばれ、finally hook が呼ばれる
- AC11: runEntry で execute が成功した場合、post hook が呼ばれ、finally hook が呼ばれる（onError は呼ばれない）
- AC12: スキルテンプレート (flow-plan, flow-impl) が更新され、冗長な set step 呼び出しが削除されている

## Open Questions

- [x] context.js の `loadConfig` 未インポートバグ（line 141）は別 spec で対応する（本 spec のスコープ外）

## Design Notes

### Why this approach

- **hook への集約**: スキルが `set step` を呼び忘れるリスクを排除。コマンド実行と状態更新が確実に連動する。
- **prepare-spec の例外扱い**: flow.json を作成するコマンドは prepare-spec のみ。作成時に初期データを含めるのは自然。他の run コマンドは既存 flow.json を操作するだけなので hook パターンが適切。
- **incrementMetric の post hook 化**: 「状態書き込みは hook の責務」という一貫したパターンを維持。context.js は純粋にデータ取得に専念する。

### Files to modify

| File | Changes |
|------|---------|
| `src/flow.js` | runEntry を pre/post/onError/finally 対応に変更 |
| `src/flow/registry.js` | before→pre, after→post リネーム。全 run コマンドに hook 追加。get.context, set.redo に post hook 追加 |
| `src/lib/flow-state.js` | incrementMetric 関数を追加（context.js から移動） |
| `src/flow/get/context.js` | incrementMetric 呼び出しを削除 |
| `src/flow/run/prepare-spec.js` | --issue/--request 引数追加 |
| `src/templates/skills/sdd-forge.flow-plan/SKILL.md` | hook 化された step 削除、引数追加、metric 記録指示追加 |
| `src/templates/skills/sdd-forge.flow-impl/SKILL.md` | hook 化された step 削除、metric 記録指示追加 |
